import { describe, expect, it } from 'vitest'

import { myTaskGroup, taskDisplayStatus, taskEventLabel, type RiceTask, type TaskEvent } from './types'

const event = (overrides: Partial<TaskEvent>): TaskEvent => ({
  id: 'event-1',
  from_status: 'open',
  to_status: 'in_progress',
  detail: null,
  actor: null,
  inserted_at: '2026-09-03T00:00:00Z',
  ...overrides,
})

describe('task labels', () => {
  it('stops showing recruitment at the deadline while keeping cancelled tasks cancelled', () => {
    const task = { status: 'open', application_deadline: '2026-09-21T09:00:00Z' } as const
    const deadline = Date.parse(task.application_deadline)
    expect(taskDisplayStatus(task, deadline - 1)).toBe('招募中')
    expect(taskDisplayStatus(task, deadline)).toBe('申请已截止')
    expect(taskDisplayStatus({ ...task, status: 'cancelled' }, deadline)).toBe('已取消')
  })

  it('describes user actions without exposing state-machine transitions', () => {
    expect(taskEventLabel(event({ from_status: 'draft', to_status: 'open' }))).toBe('发布任务')
    expect(taskEventLabel(event({}))).toBe('选定承接者')
    expect(taskEventLabel(event({ from_status: 'under_review' }))).toBe('退回修改')
    expect(taskEventLabel(event({ from_status: 'in_progress' }))).toBe('更新任务进展')
  })
})

it('keeps candidate decisions separate from deliverable review and closed applications', () => {
  const task = { status: 'in_progress', my_application_status: 'not_selected', application_count: 2, allowed_actions: ['appoint', 'reject_application'] } as RiceTask
  expect(myTaskGroup(task, false)).toBe('ended')
  expect(myTaskGroup({ ...task, status: 'open', my_application_status: 'pending' }, true)).toBe('pending')
  expect(myTaskGroup({ ...task, status: 'open', my_application_status: 'pending' }, false)).toBe('applying')
  expect(myTaskGroup({ ...task, status: 'under_review', my_application_status: 'appointed' }, false)).toBe('under_review')
})

it('returns an open task to recruitment after all applications have been rejected', () => {
  const task = { status: 'open', my_application_status: 'not_selected', application_count: 2, allowed_actions: ['cancel'] } as RiceTask
  expect(myTaskGroup(task, true)).toBe('open')
  expect(myTaskGroup(task, false)).toBe('ended')
})

it.each(['appoint', 'reject_application'] as const)('keeps a publisher task pending while %s is allowed', (action) => {
  const task = { status: 'open', my_application_status: null, application_count: 2, allowed_actions: [action, 'cancel'] } as RiceTask
  expect(myTaskGroup(task, true)).toBe('pending')
})
