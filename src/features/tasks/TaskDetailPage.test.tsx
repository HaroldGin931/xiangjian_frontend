import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { RiceSession } from '~/lib/models'
import { TaskDetailPage } from './TaskDetailPage'
import type { RiceTask } from './types'

const state = vi.hoisted(() => ({ session: null as RiceSession | null }))
vi.mock('../session/session', () => ({ useStoredSession: () => ({ session: state.session, isReady: true }) }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...await original<typeof import('@tanstack/react-router')>(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))

it('keeps a cancelled task readable to its publisher and applicants but hidden from strangers', () => {
  const task = {
    id: 'task-1', title: '修缮门楼', description: '保留任务记录', status: 'cancelled',
    creator: { id: 'publisher', did: 'did:example:publisher', handle: 'publisher' },
    assignee: null, application_count: 0, reward_amount: 1, reward_status: 'refunded',
    application_deadline: null, execution_deadline: null, applications: [], submissions: [], events: [],
    allowed_actions: [], my_application_status: null,
  } as unknown as RiceTask
  const initial = { task, error: '', viewerToken: 'token' }
  state.session = { token: 'token', user: { id: 'publisher' } } as RiceSession
  expect(renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={initial} />)).toContain('修缮门楼')

  state.session = { token: 'token', user: { id: 'applicant' } } as RiceSession
  const applicantTask = { ...task, my_application_status: 'cancelled' as const }
  expect(renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={{ ...initial, task: applicantTask }} />)).toContain('修缮门楼')
  const fallbackTask = { ...task, my_application: {
    id: 'application-1', status: 'cancelled' as const, reason: '', inserted_at: '2026-09-21T09:00:00Z',
    user: { ...task.creator, id: 'applicant', did: 'did:example:applicant', handle: 'applicant' },
  } }
  expect(renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={{ ...initial, task: fallbackTask }} />)).toContain('修缮门楼')

  state.session = { token: 'token', user: { id: 'viewer' } } as RiceSession
  const html = renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={initial} />)
  expect(html).toContain('任务已取消。')
  expect(html).not.toContain('修缮门楼')

  state.session = null
  expect(renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={{ task: applicantTask, error: '', viewerToken: null }} />)).not.toContain('修缮门楼')
})

it('shows an expired open task immediately and hides stale recruitment actions', () => {
  const task = {
    id: 'task-2', title: '修缮门楼', description: '说明', status: 'open',
    creator: { id: 'publisher', did: 'did:example:publisher', handle: 'publisher' },
    assignee: null, application_count: 1, reward_amount: 1, reward_status: 'reserved',
    application_deadline: '2026-09-21T09:00:00Z', applications: [], submissions: [], events: [],
    allowed_actions: ['appoint', 'reject_application', 'cancel'], my_application_status: null,
  } as unknown as RiceTask
  state.session = { token: 'token', user: { id: 'publisher' } } as RiceSession
  const html = renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={{ task, error: '', viewerToken: 'token' }} />)
  expect(html).toContain('已失效')
  expect(html).not.toContain('待审批申请')
  expect(html).not.toContain('取消任务')
})

it('shows late delivery as overdue while leaving supplementary submission available', () => {
  const task = {
    id: 'task-3', title: '补交成果', description: '说明', status: 'in_progress',
    creator: { id: 'publisher', did: 'did:example:publisher', handle: 'publisher' },
    assignee: { id: 'assignee', did: 'did:example:assignee', handle: 'assignee' },
    application_count: 1, reward_amount: 1, reward_status: 'reserved',
    application_deadline: null, execution_deadline: '2026-09-21T09:00:00Z',
    applications: [], submissions: [], events: [], allowed_actions: ['submit_result'], my_application_status: 'appointed',
  } as unknown as RiceTask
  state.session = { token: 'token', user: { id: 'assignee' } } as RiceSession
  const html = renderToStaticMarkup(<TaskDetailPage taskId={task.id} initial={{ task, error: '', viewerToken: 'token' }} />)
  expect(html).toContain('status-overdue')
  expect(html).toContain('任务已超时')
  expect(html).toContain('提交结果')
})
