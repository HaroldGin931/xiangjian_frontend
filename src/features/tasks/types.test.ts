import { describe, expect, it } from 'vitest'

import { taskApplicationStatusLabel, taskEventLabel, type TaskEvent } from './types'

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
  it('keeps completed applications distinct from cancelled and expired history', () => {
    expect(taskApplicationStatusLabel.not_selected).toBe('未入选')
    expect(taskApplicationStatusLabel.cancelled).toBe('任务已取消')
    expect(taskApplicationStatusLabel.expired).toBe('任务已失效')
  })

  it('describes user actions without exposing state-machine transitions', () => {
    expect(taskEventLabel(event({ from_status: 'draft', to_status: 'open' }))).toBe('发布任务')
    expect(taskEventLabel(event({}))).toBe('选定承接者')
    expect(taskEventLabel(event({ from_status: 'under_review' }))).toBe('退回修改')
    expect(taskEventLabel(event({ from_status: 'in_progress' }))).toBe('更新任务进展')
  })
})

it('keeps candidate decisions separate from deliverable review and closed applications', async () => {
  const { myTaskGroup } = await import('./types')
  const task = { status: 'in_progress', my_application_status: 'not_selected', application_count: 2 } as import('./types').RiceTask
  expect(myTaskGroup(task, false)).toBe('ended')
  expect(myTaskGroup({ ...task, status: 'open', my_application_status: 'pending' }, true)).toBe('pending')
  expect(myTaskGroup({ ...task, status: 'open', my_application_status: 'pending' }, false)).toBe('applying')
  expect(myTaskGroup({ ...task, status: 'under_review', my_application_status: 'appointed' }, false)).toBe('under_review')
})
