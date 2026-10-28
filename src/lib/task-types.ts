/**
 * Task enums, in their own module with no dependencies.
 *
 * Client components (SettingsClient, ProjectActivityActions) and the MCP tool
 * schema all need these. They can't come from src/lib/tasks.ts, which pulls in
 * Resend and Slack and would drag the server runtime into the client bundle.
 *
 * Team task visibility is gated on task-type subscriptions (migration 026), so
 * a type outside this list makes a task invisible to anyone filtering by type.
 * Add here and nowhere else.
 */
export const TASK_TYPES = [
  'Design',
  'Engineering',
  'Permitting',
  'Interconnection',
  'Financial',
  'Legal',
  'Construction',
  'Operations',
  'Administrative',
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]
