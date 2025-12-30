import { z } from "zod"

/**
 * HistoryItem
 */

export const historyItemSchema = z.object({
	id: z.string(),
	rootTaskId: z.string().optional(),
	parentTaskId: z.string().optional(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
	workspace: z.string().optional(),
	mode: z.string().optional(),
	/**
	 * The tool protocol used by this task. Once a task uses tools with a specific
	 * protocol (XML or Native), it is permanently locked to that protocol.
	 *
	 * - "xml": Tool calls are parsed from XML text (no tool IDs)
	 * - "native": Tool calls come as tool_call chunks with IDs
	 *
	 * This ensures task resumption works correctly even when NTC settings change.
	 */
	toolProtocol: z.enum(["xml", "native"]).optional(),
	status: z.enum(["active", "completed", "delegated"]).optional(),
	delegatedToId: z.string().optional(), // Last child this parent delegated to
	childIds: z.array(z.string()).optional(), // All children spawned by this task
	awaitingChildId: z.string().optional(), // Child currently awaited (set when delegated)
	completedByChildId: z.string().optional(), // Child that completed and resumed this parent
	completionResultSummary: z.string().optional(), // Summary from completed child
	/** Whether this task can be resumed by its parent via resume_subtask tool */
	resumable: z.boolean().optional(),
	/** ID of the original task this task was resumed from (for tracking resume chains) */
	resumedFromId: z.string().optional(),
	/** Number of times this task has been resumed (starts at 0, increments on each resume) */
	resumeCount: z.number().optional(),
	/** Timestamp of the last time this task was resumed (Unix epoch milliseconds) */
	lastResumedAt: z.number().optional(),
	/** IDs of children that have been resumed into this parent via resume_subtask tool */
	resumedChildIds: z.array(z.string()).optional(),
})

export type HistoryItem = z.infer<typeof historyItemSchema>
