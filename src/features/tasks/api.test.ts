import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildTaskListQuery, rejectTaskApplicationRequest } from './api'

afterEach(() => vi.unstubAllGlobals())

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

it('rejects the specified application using Rice auth and keeps the returned open task and reserved reward', async () => {
  const task = {
    id: 'task-1', status: 'open', reward_status: 'reserved', reward_amount: 80,
    application_count: 1, allowed_actions: ['cancel'],
    applications: [{ id: 'application-1', status: 'not_selected' }],
  }
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: task }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)

  const result = await rejectTaskApplicationRequest({ token: 'rice-token', taskId: 'task-1', applicationId: 'application-1' })

  expect(result).toEqual(task)
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, options] = fetch.mock.calls[0]
  expect(new URL(url).pathname).toBe('/api/tasks/task-1/applications/application-1/reject')
  expect(options.method).toBe('POST')
  expect(options.headers).toEqual({ Authorization: 'Bearer rice-token' })
  expect(options.body).toBeUndefined()
})
