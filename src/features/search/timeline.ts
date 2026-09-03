import type { PostView } from '~/lib/models'
import type { RiceTask } from '~/features/tasks/types'

export type SearchScope = 'all' | 'posts' | 'tasks'
export type SearchItem =
  | { kind: 'post'; post: PostView }
  | { kind: 'task'; task: RiceTask }

type SourcePage<T> = { items: T[]; nextCursor: string | null }
type SourceLoader<T> = (cursor?: string) => Promise<SourcePage<T>>

export type SearchTimelineState = {
  posts: PostView[]
  tasks: RiceTask[]
  postCursor?: string
  taskCursor?: string
  postsDone: boolean
  tasksDone: boolean
}

export function createSearchTimeline(scope: SearchScope): SearchTimelineState {
  return {
    posts: [],
    tasks: [],
    postsDone: scope === 'tasks',
    tasksDone: scope === 'posts',
  }
}

function itemTime(item: SearchItem) {
  const value = item.kind === 'post'
    ? item.post.indexedAt
    : item.task.published_at ?? item.task.inserted_at
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

function isPostNewer(post: PostView, task: RiceTask) {
  const postItem: SearchItem = { kind: 'post', post }
  const taskItem: SearchItem = { kind: 'task', task }
  const difference = itemTime(postItem) - itemTime(taskItem)
  if (difference !== 0) return difference > 0
  return post.uri.localeCompare(task.id) >= 0
}

export async function takeSearchPage(
  current: SearchTimelineState,
  loaders: { posts: SourceLoader<PostView>; tasks: SourceLoader<RiceTask> },
  limit = 10,
) {
  const state: SearchTimelineState = {
    ...current,
    posts: [...current.posts],
    tasks: [...current.tasks],
  }
  const items: SearchItem[] = []

  const fillPosts = async () => {
    if (state.posts.length || state.postsDone) return
    const cursor = state.postCursor
    const page = await loaders.posts(cursor)
    state.posts = page.items
    state.postCursor = page.nextCursor ?? undefined
    state.postsDone = page.nextCursor === null || (!page.items.length && page.nextCursor === cursor)
  }

  const fillTasks = async () => {
    if (state.tasks.length || state.tasksDone) return
    const cursor = state.taskCursor
    const page = await loaders.tasks(cursor)
    state.tasks = page.items
    state.taskCursor = page.nextCursor ?? undefined
    state.tasksDone = page.nextCursor === null || (!page.items.length && page.nextCursor === cursor)
  }

  while (items.length < limit) {
    await Promise.all([fillPosts(), fillTasks()])
    const post = state.posts[0]
    const task = state.tasks[0]
    if (!post && !task) break

    if (post && (!task || isPostNewer(post, task))) {
      items.push({ kind: 'post', post: state.posts.shift()! })
    } else {
      items.push({ kind: 'task', task: state.tasks.shift()! })
    }
  }

  return {
    items,
    state,
    hasMore:
      state.posts.length > 0 || state.tasks.length > 0 ||
      !state.postsDone || !state.tasksDone,
  }
}
