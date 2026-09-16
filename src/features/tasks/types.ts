import type { RicePublicUser, RiceAttachment } from '~/lib/models'

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
  attachments?: RiceAttachment[]
  id: string
  title: string
  description: string
  node?: { id: string; name: string; logo: RiceAttachment | null }
  requirement?: string
  execution_deadline?: string | null
  application_closed?: boolean
  overdue?: boolean
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
  open: '招募中',
  in_progress: '进行中',
  under_review: '待验收',
  completed: '已完成',
  expired: '已失效',
  cancelled: '已取消',
}

export const taskApplicationStatusLabel: Record<TaskApplication['status'], string> = {
  pending: '申请中',
  appointed: '已入选',
  not_selected: '未入选',
  cancelled: '任务已取消',
  expired: '任务已失效',
}

export function taskEventLabel(event: TaskEvent) {
  if (event.from_status === event.to_status) return '更新任务进展'
  switch (event.to_status) {
    case 'draft': return '创建任务草稿'
    case 'open': return '发布任务'
    case 'in_progress': return event.from_status === 'under_review' ? '退回修改' : '选定承接者'
    case 'under_review': return '提交成果'
    case 'completed': return '验收通过，任务完成'
    case 'cancelled': return '任务取消'
    case 'expired': return '任务已结束'
  }
}

export type TaskGroup = 'pending' | 'applying' | 'in_progress' | 'under_review' | 'ended' | 'open' | 'draft'
export function myTaskGroup(task: RiceTask, isPublisher: boolean): TaskGroup {
  if (task.status === 'draft') return 'draft'
  if (['completed', 'cancelled', 'expired'].includes(task.status) || (!isPublisher && task.my_application_status === 'not_selected')) return 'ended'
  if (task.status === 'open') return isPublisher ? task.application_count === 0 ? 'open' : 'pending' : 'applying'
  return task.status === 'under_review' ? 'under_review' : 'in_progress'
}
