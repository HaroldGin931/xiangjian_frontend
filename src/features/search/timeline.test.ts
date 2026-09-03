import { describe, expect, it, vi } from 'vitest'

import type { PostView } from '~/lib/models'
import type { RiceTask } from '~/features/tasks/types'

import { createSearchTimeline, takeSearchPage } from './timeline'

const post = (id: string, time: string) => ({
  uri: `at://did:example/app.bsky.feed.post/${id}`,
  indexedAt: time,
}) as PostView

const task = (id: string, time: string) => ({
  id,
  published_at: time,
  inserted_at: time,
}) as RiceTask

describe('search timeline', () => {
  it('loads the next post page before older buffered tasks', async () => {
    const today = Array.from({ length: 10 }, (_, index) =>
      post(`today-${index}`, `2026-09-04T${String(20 - index).padStart(2, '0')}:00:00Z`))
    const yesterday = Array.from({ length: 10 }, (_, index) =>
      post(`yesterday-${index}`, `2026-09-03T${String(20 - index).padStart(2, '0')}:00:00Z`))
    const olderTasks = Array.from({ length: 10 }, (_, index) =>
      task(`task-${index}`, `2026-09-02T${String(20 - index).padStart(2, '0')}:00:00Z`))
    const loadPosts = vi.fn()
      .mockResolvedValueOnce({ items: today, nextCursor: 'post-page-2' })
      .mockResolvedValueOnce({ items: yesterday, nextCursor: null })
    const loadTasks = vi.fn()
      .mockResolvedValueOnce({ items: olderTasks, nextCursor: null })

    const first = await takeSearchPage(createSearchTimeline('all'), {
      posts: loadPosts,
      tasks: loadTasks,
    })
    const second = await takeSearchPage(first.state, {
      posts: loadPosts,
      tasks: loadTasks,
    })

    expect(first.items.map((item) => item.kind)).toEqual(Array(10).fill('post'))
    expect(second.items.map((item) => item.kind)).toEqual(Array(10).fill('post'))
    expect(loadPosts).toHaveBeenCalledTimes(2)
    expect(loadTasks).toHaveBeenCalledTimes(1)
  })
})
