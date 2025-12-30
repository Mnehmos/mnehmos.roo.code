/**
 * XML format prompt description for the resume_subtask tool.
 */
const PROMPT = `## resume_subtask
Description: Resume a previously completed child subtask to inject its context back into the current parent task. Use this when you need to continue work that a subtask has already completed, especially when the context was lost due to context truncation or when you want to re-examine the subtask's results.

Parameters:
- task_id: (required) The ID of the completed child subtask to resume. This must be a subtask that was previously created by this parent task.
- context_strategy: (optional) How to include the child's context. Options:
  - "summary" (default): Include only the completion summary
  - "last_n_messages": Include the last 10 messages from the child's conversation
  - "full_history": Include the entire conversation history from the child
- include_full_history: (optional) If true, include the child's full API conversation history in addition to the context. Default: false.

Usage:
<resume_subtask>
<task_id>child-task-id-here</task_id>
<context_strategy>summary</context_strategy>
</resume_subtask>

Example - Resume with summary context:
<resume_subtask>
<task_id>abc123-def456</task_id>
</resume_subtask>

Example - Resume with recent messages:
<resume_subtask>
<task_id>abc123-def456</task_id>
<context_strategy>last_n_messages</context_strategy>
</resume_subtask>

Example - Resume with full history:
<resume_subtask>
<task_id>abc123-def456</task_id>
<context_strategy>full_history</context_strategy>
<include_full_history>true</include_full_history>
</resume_subtask>
`

export const getResumeSubtaskDescription = (): string => PROMPT
