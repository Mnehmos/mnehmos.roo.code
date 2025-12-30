// npx vitest core/tools/__tests__/resumeSubtaskTool.spec.ts

import type { AskApproval, HandleError } from "../../../shared/tools"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
		})),
	},
}))

// Mock Package module
vi.mock("../../../shared/package", () => ({
	Package: {
		name: "roo-cline",
		publisher: "RooVeterinaryInc",
		version: "1.0.0",
		outputChannel: "Roo-Code",
	},
}))

// Mock formatResponse
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg: string) => `Tool Error: ${msg}`),
	},
}))

// Mock dependencies
const mockAskApproval = vi.fn<AskApproval>()
const mockHandleError = vi.fn<HandleError>()
const mockPushToolResult = vi.fn()
const mockRemoveClosingTag = vi.fn((_name: string, value: string | undefined) => value ?? "")
const mockRecordToolError = vi.fn()
const mockSayAndCreateMissingParamError = vi.fn()

// Mock resumeCompletedChild on provider
const mockResumeCompletedChild = vi.fn()

// Mock history items for task lookup - simulates getTaskHistoryItem
const mockHistoryItems = new Map<string, { resumable: boolean; id: string }>()

// Mock provider with getState that can look up tasks
const mockProvider = {
	getState: vi.fn(() => ({
		customModes: [],
		mode: "orchestrator",
	})),
	resumeCompletedChild: mockResumeCompletedChild,
	getTaskHistoryItem: vi.fn((taskId: string) => mockHistoryItems.get(taskId)),
}

// Mock the Task (Cline) instance
const mockCline = {
	ask: vi.fn(),
	sayAndCreateMissingParamError: mockSayAndCreateMissingParamError,
	recordToolError: mockRecordToolError,
	consecutiveMistakeCount: 0,
	didToolFailInCurrentTurn: false,
	taskId: "parent-task-id",
	providerRef: {
		deref: vi.fn(() => mockProvider),
	},
}

// Import AFTER mocks are set up
import { resumeSubtaskTool } from "../ResumeSubtaskTool"
import type { ToolUse } from "../../../shared/tools"

describe("resumeSubtaskTool", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockAskApproval.mockResolvedValue(true)
		mockCline.consecutiveMistakeCount = 0
		mockCline.didToolFailInCurrentTurn = false
		mockHistoryItems.clear()
	})

	describe("parameter validation", () => {
		it("should error when task_id is missing", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					// task_id missing
					follow_up_message: "Continue with next step",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockSayAndCreateMissingParamError).toHaveBeenCalledWith("resume_subtask", "task_id")
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("resume_subtask")
		})

		it("should error when follow_up_message is missing", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "child-task-1",
					// follow_up_message missing
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockSayAndCreateMissingParamError).toHaveBeenCalledWith("resume_subtask", "follow_up_message")
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("resume_subtask")
		})
	})

	describe("task lookup validation", () => {
		it("should error when task_id does not exist", async () => {
			// Task doesn't exist in history
			mockProvider.getTaskHistoryItem.mockReturnValue(undefined)

			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "non-existent-task",
					follow_up_message: "Continue",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("not found"))
		})

		it("should error when task is not resumable", async () => {
			// Task exists but is not resumable
			mockHistoryItems.set("non-resumable-task", { resumable: false, id: "non-resumable-task" })
			mockProvider.getTaskHistoryItem.mockReturnValue({ resumable: false, id: "non-resumable-task" })

			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "non-resumable-task",
					follow_up_message: "Continue",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("not resumable"))
		})
	})

	describe("successful execution", () => {
		it("should call resumeCompletedChild with correct params when validation passes", async () => {
			// Task exists and is resumable
			mockHistoryItems.set("resumable-task", { resumable: true, id: "resumable-task" })
			mockProvider.getTaskHistoryItem.mockReturnValue({ resumable: true, id: "resumable-task" })
			mockResumeCompletedChild.mockResolvedValue({ taskId: "new-instance-1" })

			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue with next step",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockResumeCompletedChild).toHaveBeenCalledWith({
				parentTaskId: "parent-task-id",
				childTaskId: "resumable-task",
				followUpMessage: "Continue with next step",
				preserveTodos: true, // default
				contextStrategy: "full", // default
			})
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Resumed task"))
		})

		it("should pass optional parameters when provided", async () => {
			mockHistoryItems.set("resumable-task", { resumable: true, id: "resumable-task" })
			mockProvider.getTaskHistoryItem.mockReturnValue({ resumable: true, id: "resumable-task" })
			mockResumeCompletedChild.mockResolvedValue({ taskId: "new-instance-1" })

			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue with new instructions",
					preserve_todos: "false",
					context_strategy: "summarize",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockResumeCompletedChild).toHaveBeenCalledWith({
				parentTaskId: "parent-task-id",
				childTaskId: "resumable-task",
				followUpMessage: "Continue with new instructions",
				preserveTodos: false,
				contextStrategy: "summarize",
			})
		})
	})

	describe("context_strategy validation", () => {
		beforeEach(() => {
			// Setup resumable task for all tests
			mockHistoryItems.set("resumable-task", { resumable: true, id: "resumable-task" })
			mockProvider.getTaskHistoryItem.mockReturnValue({ resumable: true, id: "resumable-task" })
			mockResumeCompletedChild.mockResolvedValue({ taskId: "new-instance-1" })
		})

		it("should accept context_strategy 'full'", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue",
					context_strategy: "full",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockResumeCompletedChild).toHaveBeenCalledWith(expect.objectContaining({ contextStrategy: "full" }))
		})

		it("should accept context_strategy 'summarize'", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue",
					context_strategy: "summarize",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockResumeCompletedChild).toHaveBeenCalledWith(
				expect.objectContaining({ contextStrategy: "summarize" }),
			)
		})

		it("should accept context_strategy 'truncate'", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue",
					context_strategy: "truncate",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockResumeCompletedChild).toHaveBeenCalledWith(
				expect.objectContaining({ contextStrategy: "truncate" }),
			)
		})

		it("should reject invalid context_strategy", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue",
					context_strategy: "invalid_strategy",
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Should NOT call resumeCompletedChild
			expect(mockResumeCompletedChild).not.toHaveBeenCalled()
			// Should push error result
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("invalid"))
		})

		it("should default to 'full' when context_strategy is not provided", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "resume_subtask",
				params: {
					task_id: "resumable-task",
					follow_up_message: "Continue",
					// context_strategy not provided
				},
				partial: false,
			}

			await resumeSubtaskTool.handle(mockCline as any, block as ToolUse<"resume_subtask">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockResumeCompletedChild).toHaveBeenCalledWith(expect.objectContaining({ contextStrategy: "full" }))
		})
	})
})
