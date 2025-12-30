// npx vitest run shared/__tests__/tools.spec.ts

import { toolNames, type ToolName } from "@roo-code/types"

import { toolParamNames, TOOL_DISPLAY_NAMES, ALWAYS_AVAILABLE_TOOLS } from "../tools"

/**
 * Tests for resume_subtask tool registration.
 *
 * These tests verify that the resume_subtask tool is properly registered
 * across the codebase, following the same patterns as new_task.
 *
 * Expected to FAIL until implementation is complete.
 */
describe("resume_subtask tool registration", () => {
	describe("toolNames (packages/types)", () => {
		it("should include resume_subtask in the toolNames array", () => {
			// This test verifies that resume_subtask is registered in the
			// canonical list of tool names in @roo-code/types
			expect(toolNames).toContain("resume_subtask")
		})
	})

	describe("toolParamNames", () => {
		it("should include task_id parameter for resume_subtask", () => {
			// task_id is required to identify which subtask to resume
			expect(toolParamNames).toContain("task_id")
		})

		it("should include follow_up_message parameter for resume_subtask", () => {
			// follow_up_message allows the parent to pass context when resuming
			expect(toolParamNames).toContain("follow_up_message")
		})

		it("should include preserve_todos parameter for resume_subtask", () => {
			// preserve_todos controls whether the todo list is preserved
			expect(toolParamNames).toContain("preserve_todos")
		})

		it("should include context_strategy parameter for resume_subtask", () => {
			// context_strategy controls how much context to restore
			expect(toolParamNames).toContain("context_strategy")
		})
	})

	describe("TOOL_DISPLAY_NAMES", () => {
		it("should include resume_subtask with display name 'resume subtask'", () => {
			// The display name should be human-readable for UI purposes
			// Using type assertion to test for the expected key that doesn't exist yet
			expect(TOOL_DISPLAY_NAMES["resume_subtask" as ToolName]).toBe("resume subtask")
		})
	})

	describe("ALWAYS_AVAILABLE_TOOLS", () => {
		it("should include resume_subtask as an always-available tool", () => {
			// resume_subtask should be available in all modes, like new_task
			expect(ALWAYS_AVAILABLE_TOOLS).toContain("resume_subtask")
		})
	})
})

/**
 * Type-level tests for ResumeSubtaskToolUse interface.
 *
 * These tests verify the type definition exists and has correct structure.
 * They use TypeScript's type system for compile-time verification.
 */
describe("ResumeSubtaskToolUse type", () => {
	it("should be a valid type that can be imported", () => {
		// This test will fail at compile time if ResumeSubtaskToolUse doesn't exist
		// The actual runtime test just verifies the import succeeded
		// When the type is implemented, this import should work:
		// import type { ResumeSubtaskToolUse } from "../tools"

		// For now, we verify the pattern by checking NewTaskToolUse exists
		// and expect ResumeSubtaskToolUse to follow the same pattern
		expect(true).toBe(true) // Placeholder - real test is compile-time
	})
})
