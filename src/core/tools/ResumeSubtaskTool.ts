import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

/** Valid context strategies for resume_subtask */
const VALID_CONTEXT_STRATEGIES = ["full", "summarize", "truncate"] as const

/** Type for valid context strategy values */
type ContextStrategy = (typeof VALID_CONTEXT_STRATEGIES)[number]

/**
 * Parameters for the resume_subtask tool.
 */
interface ResumeSubtaskParams {
	/** ID of the completed task to resume */
	task_id: string
	/** New instructions or follow-up work for the resumed task */
	follow_up_message: string
	/** Whether to preserve existing todos (default: true) */
	preserve_todos?: string
	/** Context loading strategy: "full" | "summarize" | "truncate" (default: "full") */
	context_strategy?: string
}

/**
 * Tool for resuming a previously completed child task with a follow-up message.
 *
 * Used by orchestrator modes to continue work on a task that was completed
 * but needs additional work based on new requirements or feedback.
 *
 * @example
 * ```xml
 * <resume_subtask>
 *   <task_id>child-task-123</task_id>
 *   <follow_up_message>Please also add error handling</follow_up_message>
 *   <preserve_todos>true</preserve_todos>
 *   <context_strategy>full</context_strategy>
 * </resume_subtask>
 * ```
 */
export class ResumeSubtaskTool extends BaseTool<"resume_subtask"> {
	readonly name = "resume_subtask" as const

	/**
	 * Parses legacy XML-style parameters into typed ResumeSubtaskParams.
	 *
	 * @param params - Raw string key-value pairs from XML parsing
	 * @returns Typed parameters with defaults for missing optional values
	 */
	parseLegacy(params: Partial<Record<string, string>>): ResumeSubtaskParams {
		return {
			task_id: params.task_id || "",
			follow_up_message: params.follow_up_message || "",
			preserve_todos: params.preserve_todos,
			context_strategy: params.context_strategy,
		}
	}

	/**
	 * Executes the resume_subtask tool to resume a completed child task.
	 *
	 * Workflow:
	 * 1. Validates required parameters (task_id, follow_up_message)
	 * 2. Verifies provider reference is still valid
	 * 3. Looks up the task and validates it exists and is resumable
	 * 4. Validates context_strategy if provided
	 * 5. Asks for user approval before resuming
	 * 6. Calls provider.resumeCompletedChild to create the resumed task
	 *
	 * @param params - The parsed tool parameters
	 * @param task - The current parent task context
	 * @param callbacks - Tool execution callbacks for approval, errors, and results
	 */
	async execute(params: ResumeSubtaskParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { task_id, follow_up_message, preserve_todos, context_strategy } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// === Step 1: Validate required parameters ===
			if (!task_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("resume_subtask")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("resume_subtask", "task_id"))
				return
			}

			if (!follow_up_message) {
				task.consecutiveMistakeCount++
				task.recordToolError("resume_subtask")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("resume_subtask", "follow_up_message"))
				return
			}

			// === Step 2: Verify provider reference ===
			const provider = task.providerRef.deref()
			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider reference lost"))
				return
			}

			// === Step 3: Look up task and validate existence ===
			const historyItem = (provider as any).getTaskHistoryItem(task_id)
			if (!historyItem) {
				pushToolResult(formatResponse.toolError(`Task ${task_id} not found`))
				return
			}

			// === Step 4: Validate task is resumable ===
			// Only tasks marked as resumable (completed children) can be resumed
			if (!historyItem.resumable) {
				pushToolResult(formatResponse.toolError(`Task ${task_id} is not resumable`))
				return
			}

			// === Step 5: Validate context_strategy if provided ===
			if (context_strategy && !VALID_CONTEXT_STRATEGIES.includes(context_strategy as ContextStrategy)) {
				pushToolResult(
					formatResponse.toolError(
						`Invalid context_strategy "${context_strategy}". Valid options: ${VALID_CONTEXT_STRATEGIES.join(", ")}`,
					),
				)
				return
			}

			// === Step 6: Reset mistake counter on successful validation ===
			task.consecutiveMistakeCount = 0

			// === Step 7: Parse optional parameters with defaults ===
			// preserve_todos defaults to true unless explicitly set to "false"
			const preserveTodosValue = preserve_todos === "false" ? false : true
			// context_strategy defaults to "full" for complete history loading
			const contextStrategyValue = (context_strategy as ContextStrategy) || "full"

			// === Step 8: Ask for user approval ===
			// Similar to new_task, we require user confirmation before resuming
			const toolMessage = JSON.stringify({
				tool: "resumeSubtask",
				taskId: task_id,
				followUpMessage: follow_up_message,
				preserveTodos: preserveTodosValue,
				contextStrategy: contextStrategyValue,
			})

			const didApprove = await askApproval("tool", toolMessage)
			if (!didApprove) {
				return
			}

			// === Step 9: Resume the completed child task ===
			const resumedTask = await (provider as any).resumeCompletedChild({
				parentTaskId: task.taskId,
				childTaskId: task_id,
				followUpMessage: follow_up_message,
				preserveTodos: preserveTodosValue,
				contextStrategy: contextStrategyValue,
			})

			// === Step 10: Return success result ===
			pushToolResult(`Resumed task ${resumedTask.taskId}`)
			return
		} catch (error) {
			await handleError("resuming subtask", error)
			return
		}
	}

	/**
	 * Handles partial (streaming) updates during tool input parsing.
	 *
	 * Called as the LLM streams each parameter, allowing real-time UI updates
	 * to show the user what parameters are being specified.
	 *
	 * @param task - The current task context
	 * @param block - The partial tool use block with streaming parameters
	 */
	override async handlePartial(task: Task, block: ToolUse<"resume_subtask">): Promise<void> {
		const task_id = block.params.task_id
		const follow_up_message = block.params.follow_up_message
		const preserve_todos = block.params.preserve_todos
		const context_strategy = block.params.context_strategy

		// Build a partial message for UI display, stripping incomplete closing tags
		const partialMessage = JSON.stringify({
			tool: "resumeSubtask",
			taskId: this.removeClosingTag("task_id", task_id, block.partial),
			followUpMessage: this.removeClosingTag("follow_up_message", follow_up_message, block.partial),
			preserveTodos: this.removeClosingTag("preserve_todos", preserve_todos, block.partial),
			contextStrategy: this.removeClosingTag("context_strategy", context_strategy, block.partial),
		})

		// Fire-and-forget update to UI (errors are swallowed for streaming resilience)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

/** Singleton instance of the ResumeSubtaskTool */
export const resumeSubtaskTool = new ResumeSubtaskTool()
