import type OpenAI from "openai"

/**
 * Description for the resume_subtask tool used in native tool calling.
 */
export const RESUME_SUBTASK_DESCRIPTION = `Resume a previously completed child subtask to inject its context back into the current parent task. Use this when you need to continue work that a subtask has already completed, especially when the context was lost due to context truncation or when you want to re-examine the subtask's results.`

const TASK_ID_DESCRIPTION = `The ID of the completed child subtask to resume. This must be a subtask that was previously created by this parent task.`

const CONTEXT_STRATEGY_DESCRIPTION = `How to include the child's context. 'summary' (default) includes only the completion summary, 'last_n_messages' includes the last 10 messages, 'full_history' includes the entire conversation.`

const INCLUDE_FULL_HISTORY_DESCRIPTION = `If true, include the child's full API conversation history in addition to the context. Default: false.`

const resumeSubtask: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "resume_subtask",
		description: RESUME_SUBTASK_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				task_id: {
					type: "string",
					description: TASK_ID_DESCRIPTION,
				},
				context_strategy: {
					type: ["string", "null"],
					enum: ["summary", "last_n_messages", "full_history", null],
					description: CONTEXT_STRATEGY_DESCRIPTION,
				},
				include_full_history: {
					type: ["boolean", "null"],
					description: INCLUDE_FULL_HISTORY_DESCRIPTION,
				},
			},
			required: ["task_id", "context_strategy", "include_full_history"],
			additionalProperties: false,
		},
	},
}

export default resumeSubtask
