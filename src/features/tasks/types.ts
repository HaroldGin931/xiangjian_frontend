import type { RicePublicUser } from '~/lib/models'

export type TaskStatus =
  | 'draft'
  | 'open'
  | 'in_progress'
  | 'under_review'
  | 'completed'
  | 'expired'
  | 'cancelled'
export type TaskListStatus = TaskStatus | 'closed'
export type TaskMine = 'assigned' | 'created' | 'applied'

export type TaskApplication = {
  id: string
  reason: string
  status: 'pending' | 'appointed' | 'not_selected' | 'cancelled' | 'expired'
  user: RicePublicUser
  inserted_at: string
}

export type TaskEvent = {
  id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  detail: string | null
  actor: RicePublicUser | null
  inserted_at: string
}

export type TaskSubmission = {
  id: string
  body: string
  status: 'pending' | 'approved' | 'changes_requested'
  review_reason: string | null
  user: RicePublicUser
  inserted_at: string
}

export type RiceTask = {
  id: string
  title: string
  description: string
  status: TaskStatus
  creator: RicePublicUser
  assignee: RicePublicUser | null
  application_deadline: string | null
  appointed_at: string | null
  appointment_reason: string | null
  reward_amount: number
  reward_status: 'none' | 'reserved' | 'settled' | 'refunded'
  application_count: number
  my_application_status: TaskApplication['status'] | null
  allowed_actions: Array<
    | 'publish'
    | 'apply'
    | 'appoint'
    | 'cancel'
    | 'submit_result'
    | 'approve_result'
    | 'request_changes'
  >
  applications: TaskApplication[] | null
  submissions: TaskSubmission[] | null
  events: TaskEvent[] | null
  published_at: string | null
  inserted_at: string
  updated_at: string
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  draft: '草稿',
  open: '可领取',
  in_progress: '进行中',
  under_review: '待验收',
  completed: '已完成',
  expired: '已失效',
  cancelled: '已取消',
}

export const taskApplicationStatusLabel: Record<TaskApplication['status'], string> = {
  pending: '申请中',
  appointed: '已获任命',
  not_selected: '未获任命',
  cancelled: '任务已取消',
  expired: '任务已失效',
}

export function taskEventLabel(event: TaskEvent) {
  if (event.from_status === null) return `记录为${taskStatusLabel[event.to_status]}`
  return `${taskStatusLabel[event.from_status]} → ${taskStatusLabel[event.to_status]}`
}
