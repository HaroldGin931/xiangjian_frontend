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
    expect(taskApplicationStatusLabel.not_selected).toBe('未获任命')
    expect(taskApplicationStatusLabel.cancelled).toBe('任务已取消')
    expect(taskApplicationStatusLabel.expired).toBe('任务已失效')
  })

  it('describes initial records and later state transitions', () => {
    expect(taskEventLabel(event({ from_status: null, to_status: 'draft' }))).toBe('记录为草稿')
    expect(taskEventLabel(event({}))).toBe('可领取 → 进行中')
  })
})
