import { describe, expect, it } from 'vitest'

import { buildTaskListQuery } from './api'

describe('task list query', () => {
  it('passes filtering, search and cursor pagination to Rice', () => {
    const query = new URLSearchParams(buildTaskListQuery({
      status: 'closed',
      q: '  古村门楼  ',
      sort: 'published',
      before: '3muk26isicv2p',
      limit: 12,
    }))

    expect(Object.fromEntries(query)).toEqual({
      status: 'closed',
      q: '古村门楼',
      sort: 'published',
      before: '3muk26isicv2p',
      limit: '12',
    })
  })
})

it('asks Rice to filter by real community and applicant eligibility', () => {
  expect(Object.fromEntries(new URLSearchParams(buildTaskListQuery({ nodeId: 'node-1', available: true })))).toEqual({ node_id: 'node-1', available: 'true' })
})
