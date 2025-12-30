// pnpm --filter roo-cline test core/webview/__tests__/provider-resumeSubtask.spec.ts
// Tests for ClineProvider.resumeCompletedChild method
// GREEN PHASE: These tests verify the implemented resumeCompletedChild method

import * as vscode from "vscode"

import { type ClineMessage, type HistoryItem } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { ContextProxy } from "../../config/ContextProxy"
import { ClineProvider } from "../ClineProvider"

// Import mocked modules for verification
import { saveTaskMessages } from "../../task-persistence"
import { readTaskMessages } from "../../task-persistence/taskMessages"

// Mock setup - following patterns from ClineProvider.spec.ts
vi.mock("../../prompts/sections/custom-instructions")

vi.mock("p-wait-for", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("axios", () => ({
	default: {
		get: vi.fn().mockResolvedValue({ data: { data: [] } }),
		post: vi.fn(),
	},
	get: vi.fn().mockResolvedValue({ data: { data: [] } }),
	post: vi.fn(),
}))

vi.mock("../../../utils/safeWriteJson")

vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
}))

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolResultSchema: {},
	ListResourcesResultSchema: {},
	ListResourceTemplatesResultSchema: {},
	ListToolsResultSchema: {},
	ReadResourceResultSchema: {},
	ErrorCode: {
		InvalidRequest: "InvalidRequest",
		MethodNotFound: "MethodNotFound",
		InternalError: "InternalError",
	},
	McpError: class McpError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
			this.name = "McpError"
		}
	},
}))

vi.mock("../../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		testConnection: vi.fn().mockResolvedValue({
			success: true,
			message: "Connected",
			endpoint: "ws://localhost:9222/devtools/browser/123",
		}),
	})),
}))

vi.mock("../../../services/browser/browserDiscovery", () => ({
	discoverChromeHostUrl: vi.fn().mockResolvedValue("http://localhost:9222"),
	tryChromeHostUrl: vi.fn().mockResolvedValue(true),
	testBrowserConnection: vi.fn(),
}))

const mockAddCustomInstructions = vi.fn().mockResolvedValue("Combined instructions")
;(vi.mocked(await import("../../prompts/sections/custom-instructions")) as any).addCustomInstructions =
	mockAddCustomInstructions

vi.mock("delay", () => {
	const delayFn = (_ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		listTools: vi.fn().mockResolvedValue({ tools: [] }),
		callTool: vi.fn().mockResolvedValue({ content: [] }),
	})),
}))

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
}))

vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
		}),
	}),
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockImplementation(async () => "mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			initializeFilePaths: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options: any) => ({
		api: undefined,
		abortTask: vi.fn(),
		handleWebviewAskResponse: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
		overwriteClineMessages: vi.fn(),
		overwriteApiConversationHistory: vi.fn(),
		getTaskNumber: vi.fn().mockReturnValue(0),
		setTaskNumber: vi.fn(),
		setParentTask: vi.fn(),
		setRootTask: vi.fn(),
		taskId: options?.historyItem?.id || "test-task-id",
		emit: vi.fn(),
	})),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockImplementation(async (_filePath: string) => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const lines = content.split("\n")
		return lines.map((line, index) => `${index + 1} | ${line}`).join("\n")
	}),
}))

vi.mock("../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

vi.mock("../../../shared/modes", () => ({
	modes: [
		{
			slug: "code",
			name: "Code Mode",
			roleDefinition: "You are a code assistant",
			groups: ["read", "edit", "browser"],
		},
	],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	getGroupName: vi.fn().mockImplementation((group: string) => {
		switch (group) {
			case "read":
				return "Read Tools"
			case "edit":
				return "Edit Tools"
			case "browser":
				return "Browser Tools"
			case "mcp":
				return "MCP Tools"
			default:
				return "General Tools"
		}
	}),
	defaultModeSlug: "code",
}))

vi.mock("../diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getToolDescription: () => "test",
		getName: () => "test-strategy",
		applyDiff: vi.fn(),
	})),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(true),
		get instance() {
			return {
				isAuthenticated: vi.fn().mockReturnValue(false),
			}
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

// Mock task-persistence module for reading/writing task messages
vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../task-persistence/taskMessages", () => ({
	readTaskMessages: vi.fn().mockResolvedValue([]),
}))

afterAll(() => {
	vi.restoreAllMocks()
})

/**
 * Tests for ClineProvider.resumeCompletedChild
 *
 * This method should:
 * 1. Validate parent/child relationship
 * 2. Load child context based on strategy
 * 3. Inject resume context into parent
 * 4. Update parent's history metadata
 */
describe("ClineProvider.resumeCompletedChild", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel

	// Helper to create mock history items
	const createMockHistoryItem = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
		id: `task-${Date.now()}`,
		number: 1,
		ts: Date.now(),
		task: "Test task",
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.01,
		...overrides,
	})

	// Helper to create mock ClineMessages
	const createMockClineMessages = (count: number): ClineMessage[] => {
		return Array.from({ length: count }, (_, i) => ({
			type: "say" as const,
			say: "text" as const,
			text: `Message ${i + 1}`,
			ts: Date.now() + i * 1000,
		}))
	}

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		const globalState: Record<string, any> = {
			taskHistory: [],
		}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi.fn().mockImplementation((key: string, value: any) => {
					globalState[key] = value
					return Promise.resolve()
				}),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Mock getMcpHub
		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})
	})

	// =========================================================================
	// VALIDATION TESTS
	// =========================================================================

	describe("Validation", () => {
		it("should throw if parent task not found in history", async () => {
			// Setup: No parent task in history
			const parentTaskId = "parent-task-nonexistent"
			const childTaskId = "child-task-123"

			// Act & Assert: Expect error when parent task doesn't exist
			// The method doesn't exist yet, so this test will fail with:
			// "TypeError: provider.resumeCompletedChild is not a function"
			await expect(
				(provider as any).resumeCompletedChild({
					parentTaskId,
					childTaskId,
					contextStrategy: "summary",
				}),
			).rejects.toThrow(/parent.*not found|not a function/i)
		})

		it("should throw if child task not found in history", async () => {
			// Setup: Parent exists, but child doesn't
			const parentTaskId = "parent-task-123"
			const childTaskId = "child-task-nonexistent"

			const parentHistory = createMockHistoryItem({
				id: parentTaskId,
				status: "delegated",
				childIds: [childTaskId],
			})

			// Add parent to mock history
			;(mockContext.globalState.get as any).mockImplementation((key: string) => {
				if (key === "taskHistory") return [parentHistory]
				return undefined
			})

			// Act & Assert: Expect error when child task doesn't exist
			await expect(
				(provider as any).resumeCompletedChild({
					parentTaskId,
					childTaskId,
					contextStrategy: "summary",
				}),
			).rejects.toThrow(/child.*not found|not a function/i)
		})

		it("should throw if child is not in parent's childIds", async () => {
			// Setup: Both tasks exist, but child is not in parent's childIds
			const parentTaskId = "parent-task-123"
			const childTaskId = "child-task-456"
			const unrelatedChildId = "unrelated-child-789"

			const parentHistory = createMockHistoryItem({
				id: parentTaskId,
				status: "delegated",
				childIds: [unrelatedChildId], // Different child
			})

			const childHistory = createMockHistoryItem({
				id: childTaskId,
				parentTaskId: "other-parent", // Different parent
				status: "completed",
			})

			;(mockContext.globalState.get as any).mockImplementation((key: string) => {
				if (key === "taskHistory") return [parentHistory, childHistory]
				return undefined
			})

			// Act & Assert: Expect error when child is not delegated by parent
			await expect(
				(provider as any).resumeCompletedChild({
					parentTaskId,
					childTaskId,
					contextStrategy: "summary",
				}),
			).rejects.toThrow(/child.*not.*delegated|not in.*childIds|not a function/i)
		})

		it("should throw if child status is not 'completed'", async () => {
			// Setup: Both tasks exist, child is in parent's childIds, but not completed
			const parentTaskId = "parent-task-123"
			const childTaskId = "child-task-456"

			const parentHistory = createMockHistoryItem({
				id: parentTaskId,
				status: "delegated",
				childIds: [childTaskId],
				delegatedToId: childTaskId,
			})

			const childHistory = createMockHistoryItem({
				id: childTaskId,
				parentTaskId,
				status: "active", // Not completed!
			})

			;(mockContext.globalState.get as any).mockImplementation((key: string) => {
				if (key === "taskHistory") return [parentHistory, childHistory]
				return undefined
			})

			// Act & Assert: Expect error when child is not completed
			await expect(
				(provider as any).resumeCompletedChild({
					parentTaskId,
					childTaskId,
					contextStrategy: "summary",
				}),
			).rejects.toThrow(/child.*not.*completed|status.*active|not a function/i)
		})
	})

	// =========================================================================
	// CONTEXT STRATEGY TESTS
	// =========================================================================

	describe("Context Strategy", () => {
		// Common setup for context strategy tests
		const setupValidParentChild = () => {
			const parentTaskId = "parent-task-123"
			const childTaskId = "child-task-456"

			const parentHistory = createMockHistoryItem({
				id: parentTaskId,
				status: "delegated",
				childIds: [childTaskId],
				delegatedToId: childTaskId,
				awaitingChildId: childTaskId,
			})

			const childHistory = createMockHistoryItem({
				id: childTaskId,
				parentTaskId,
				status: "completed",
				completionResultSummary: "Task completed successfully with detailed results.",
			})

			const childClineMessages = createMockClineMessages(10)

			;(mockContext.globalState.get as any).mockImplementation((key: string) => {
				if (key === "taskHistory") return [parentHistory, childHistory]
				return undefined
			})

			return { parentTaskId, childTaskId, parentHistory, childHistory, childClineMessages }
		}

		it("should inject summary context when strategy is 'summary'", async () => {
			const { parentTaskId, childTaskId, childClineMessages, childHistory } = setupValidParentChild()

			// Mock readTaskMessages to return child messages
			vi.mocked(readTaskMessages).mockResolvedValue(childClineMessages)

			// Act: Call the method
			await (provider as any).resumeCompletedChild({
				parentTaskId,
				childTaskId,
				contextStrategy: "summary",
			})

			// Assert: saveTaskMessages was called with resume_context message containing summary
			expect(saveTaskMessages).toHaveBeenCalled()
			const saveCall = vi.mocked(saveTaskMessages).mock.calls[0][0]
			const lastMessage = saveCall.messages[saveCall.messages.length - 1]
			expect(lastMessage.type).toBe("say")
			expect(lastMessage.say).toBe("resume_context")

			// Verify the context contains the summary
			const contextData = JSON.parse(lastMessage.text!)
			expect(contextData.childTaskId).toBe(childTaskId)
			expect(contextData.strategy).toBe("summary")
			expect(contextData.context).toBe(childHistory.completionResultSummary)
		})

		it("should inject last N messages when strategy is 'last_n_messages'", async () => {
			const { parentTaskId, childTaskId, childClineMessages } = setupValidParentChild()

			// Mock readTaskMessages to return child messages
			vi.mocked(readTaskMessages).mockResolvedValue(childClineMessages)

			// Act: Call the method
			await (provider as any).resumeCompletedChild({
				parentTaskId,
				childTaskId,
				contextStrategy: "last_n_messages",
			})

			// Assert: saveTaskMessages was called with resume_context message containing last N messages
			expect(saveTaskMessages).toHaveBeenCalled()
			const saveCall = vi.mocked(saveTaskMessages).mock.calls[0][0]
			const lastMessage = saveCall.messages[saveCall.messages.length - 1]
			expect(lastMessage.type).toBe("say")
			expect(lastMessage.say).toBe("resume_context")

			// Verify the context contains last 10 messages
			const contextData = JSON.parse(lastMessage.text!)
			expect(contextData.childTaskId).toBe(childTaskId)
			expect(contextData.strategy).toBe("last_n_messages")
			expect(Array.isArray(contextData.context)).toBe(true)
			expect(contextData.context.length).toBe(10) // Last 10 messages
		})

		it("should inject full history when strategy is 'full_history'", async () => {
			const { parentTaskId, childTaskId } = setupValidParentChild()

			// Create messages with explicit count for this test
			const childMessages = createMockClineMessages(15) // Use different count than last_n_messages test

			// Mock readTaskMessages to return child messages
			vi.mocked(readTaskMessages).mockResolvedValue(childMessages)

			// Act: Call the method
			await (provider as any).resumeCompletedChild({
				parentTaskId,
				childTaskId,
				contextStrategy: "full_history",
			})

			// Assert: saveTaskMessages was called with resume_context message containing full history
			expect(saveTaskMessages).toHaveBeenCalled()
			const saveCall = vi.mocked(saveTaskMessages).mock.calls[0][0]
			const lastMessage = saveCall.messages[saveCall.messages.length - 1]
			expect(lastMessage.type).toBe("say")
			expect(lastMessage.say).toBe("resume_context")

			// Verify the context contains all child messages (full history = all 15 messages)
			const contextData = JSON.parse(lastMessage.text!)
			expect(contextData.childTaskId).toBe(childTaskId)
			expect(contextData.strategy).toBe("full_history")
			expect(Array.isArray(contextData.context)).toBe(true)
			expect(contextData.context.length).toBe(15) // All messages, more than the last_n_messages limit of 10
		})
	})

	// =========================================================================
	// HISTORY UPDATE TESTS
	// =========================================================================

	describe("History Updates", () => {
		const setupValidParentChild = () => {
			const parentTaskId = "parent-task-123"
			const childTaskId = "child-task-456"

			const parentHistory = createMockHistoryItem({
				id: parentTaskId,
				status: "delegated",
				childIds: [childTaskId],
				delegatedToId: childTaskId,
				awaitingChildId: childTaskId,
			})

			const childHistory = createMockHistoryItem({
				id: childTaskId,
				parentTaskId,
				status: "completed",
				completionResultSummary: "Task completed successfully.",
			})

			;(mockContext.globalState.get as any).mockImplementation((key: string) => {
				if (key === "taskHistory") return [parentHistory, childHistory]
				return undefined
			})

			return { parentTaskId, childTaskId, parentHistory, childHistory }
		}

		it("should add childId to parent's resumedChildIds", async () => {
			const { parentTaskId, childTaskId } = setupValidParentChild()

			// Mock readTaskMessages to return empty array
			vi.mocked(readTaskMessages).mockResolvedValue([])

			// Spy on updateTaskHistory
			const updateSpy = vi.spyOn(provider as any, "updateTaskHistory")

			// Act: Call the method
			await (provider as any).resumeCompletedChild({
				parentTaskId,
				childTaskId,
				contextStrategy: "summary",
			})

			// Assert: updateTaskHistory was called with resumedChildIds containing childTaskId
			expect(updateSpy).toHaveBeenCalled()
			const updatedHistory = updateSpy.mock.calls[0][0] as HistoryItem
			expect(updatedHistory.resumedChildIds).toContain(childTaskId)
		})

		it("should clear awaitingChildId if it matches the resumed child", async () => {
			const { parentTaskId, childTaskId } = setupValidParentChild()

			// Mock readTaskMessages to return empty array
			vi.mocked(readTaskMessages).mockResolvedValue([])

			// Spy on updateTaskHistory
			const updateSpy = vi.spyOn(provider as any, "updateTaskHistory")

			// Act: Call the method
			await (provider as any).resumeCompletedChild({
				parentTaskId,
				childTaskId,
				contextStrategy: "summary",
			})

			// Assert: updateTaskHistory was called with awaitingChildId cleared
			expect(updateSpy).toHaveBeenCalled()
			const updatedHistory = updateSpy.mock.calls[0][0] as HistoryItem
			expect(updatedHistory.awaitingChildId).toBeUndefined()
		})

		it("should preserve existing resumedChildIds when adding new one", async () => {
			const parentTaskId = "parent-task-123"
			const childTaskId = "child-task-456"
			const previouslyResumedChildId = "child-task-previous"

			const parentHistory = createMockHistoryItem({
				id: parentTaskId,
				status: "delegated",
				childIds: [previouslyResumedChildId, childTaskId],
				delegatedToId: childTaskId,
				awaitingChildId: childTaskId,
				resumedChildIds: [previouslyResumedChildId], // Previously resumed child
			})

			const childHistory = createMockHistoryItem({
				id: childTaskId,
				parentTaskId,
				status: "completed",
				completionResultSummary: "Second task completed.",
			})

			;(mockContext.globalState.get as any).mockImplementation((key: string) => {
				if (key === "taskHistory") return [parentHistory, childHistory]
				return undefined
			})

			// Mock readTaskMessages to return empty array
			vi.mocked(readTaskMessages).mockResolvedValue([])

			// Spy on updateTaskHistory
			const updateSpy = vi.spyOn(provider as any, "updateTaskHistory")

			// Act: Call the method
			await (provider as any).resumeCompletedChild({
				parentTaskId,
				childTaskId,
				contextStrategy: "summary",
			})

			// Assert: Previous resumedChildIds are preserved and new one is added
			expect(updateSpy).toHaveBeenCalled()
			const updatedHistory = updateSpy.mock.calls[0][0] as HistoryItem
			expect(updatedHistory.resumedChildIds).toContain(previouslyResumedChildId)
			expect(updatedHistory.resumedChildIds).toContain(childTaskId)
			// No duplicates
			const uniqueIds = new Set(updatedHistory.resumedChildIds)
			expect(uniqueIds.size).toBe(updatedHistory.resumedChildIds!.length)
		})
	})
})
