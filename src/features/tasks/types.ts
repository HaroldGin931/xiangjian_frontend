import type { RicePublicUser } from '~/lib/models'

export type TaskStatus = 'open' | 'in_progress' | 'under_review' | 'completed'
export type TaskMine = 'assigned' | 'created' | 'applied'

export type TaskApplication = {
  id: string
  reason: string
  status: 'pending' | 'appointed' | 'not_selected'
  user: RicePublicUser
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
  application_count: number
  my_application_status: TaskApplication['status'] | null
  allowed_actions: Array<
    'apply' | 'appoint' | 'submit_result' | 'approve_result' | 'request_changes'
  >
  applications: TaskApplication[] | null
  submissions: TaskSubmission[] | null
  inserted_at: string
  updated_at: string
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  open: '可领取',
  in_progress: '进行中',
  under_review: '待审核',
  completed: '已完成',
}
