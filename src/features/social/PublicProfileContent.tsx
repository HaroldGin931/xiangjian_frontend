import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useEffect, useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/features/feed/api'
import { getTasks } from '~/features/tasks/api'
import { TaskCard } from '~/features/tasks/TaskCard'
import type { RiceTask } from '~/features/tasks/types'
import { getEvents, type RiceEvent } from '../events/api'
import { EventCard } from '../events/EventsPage'
import { PostThreadDialog } from '../feed/PostThreadDialog'
import { postCategory } from '../feed/tags'
import type { PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'

type ProfileTab = 'tasks' | 'activities' | 'posts'

const tabs: Array<{ value: ProfileTab; label: string }> = [
  { value: 'tasks', label: '任务' },
  { value: 'activities', label: '活动' },
  { value: 'posts', label: '帖子' },
]

export function PublicProfileContent({ actor }: { actor: string }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')

  return (
    <>
      <div className="social-profile-tabs filter-buttons" role="group" aria-label="用户公开内容">
        {tabs.map((tab) => (
          <Button
            label={tab.label}
            variant="ghost"
            size="sm"
            className={activeTab === tab.value ? 'active' : undefined}
            aria-pressed={activeTab === tab.value}
            clickAction={() => setActiveTab(tab.value)}
            key={tab.value}
          />
        ))}
      </div>

      {activeTab === 'posts' ? <PublicPosts actor={actor} /> : null}
      {activeTab === 'activities' ? <PublicActivities actor={actor} /> : null}
      {activeTab === 'tasks' ? <PublicTasks actor={actor} /> : null}
    </>
  )
}

function PublicPosts({ actor }: { actor: string }) {
  const { session } = useStoredSession()
  const [selected, setSelected] = useState<PostView | null>(null)
  const [posts, setPosts] = useState<PostView[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setPosts(null)
    setError('')
    void getPosts({
      data: {
        repo: actor,
        did: session?.pds.did,
        accessJwt: session?.pds.access_jwt,
      },
    })
      .then((feed) => { if (active) setPosts(feed.posts) })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '帖子暂时无法显示')
      })
    return () => { active = false }
  }, [actor, session])

  if (error || !posts || posts.length === 0) {
    return <ProfileContentState error={error} items={posts} empty="还没有发布帖子" />
  }
  return <><PostList posts={posts.filter((p) => postCategory(p.record) === 'post')} onOpenPost={(post) => setSelected(post)} />{selected && <PostThreadDialog uri={selected.uri} category="post" focusReply={false} onClose={() => setSelected(null)} />}</>
}

function PublicTasks({ actor }: { actor: string }) {
  const { session } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setTasks(null)
    setError('')
    void Promise.all([
      getTasks({ data: { token: session?.token, participantDid: actor } }),
      getTasks({ data: { token: session?.token, creatorDid: actor } }),
    ])
      .then(([participated, created]) => {
        if (!active) return
        const unique = new Map([...participated, ...created].map((task) => [task.id, task]))
        setTasks([...unique.values()].sort((a, b) => b.inserted_at.localeCompare(a.inserted_at)))
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '任务记录暂时无法显示')
      })
    return () => { active = false }
  }, [actor, session])

  if (error || !tasks || tasks.length === 0) {
    return (
      <ProfileContentState
        error={error}
        items={tasks}
        empty="还没有任务记录"
      />
    )
  }

  return (
    <section className="task-list public-profile-list">
      {tasks.map((task) => <TaskCard task={task} key={task.id} />)}
    </section>
  )
}

function PublicActivities({ actor }: { actor: string }) {
  const { session } = useStoredSession()
  const [items, setItems] = useState<RiceEvent[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true; setItems(null); setError('')
    void Promise.all([getEvents({ data: { token: session?.token, creatorDid: actor } }), getEvents({ data: { token: session?.token, participantDid: actor } })]).then(([created, participated]) => {
      if (active) setItems([...new Map([...created.data, ...participated.data].map((event) => [event.id, event])).values()])
    }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [actor, session?.token])
  if (error || !items || !items.length) return <ProfileContentState error={error} items={items} empty="还没有活动记录" />
  return <section className="task-list public-profile-list">{items.map((event) => <EventCard event={event} key={event.id} />)}</section>
}

function ProfileContentState<T>({
  error,
  items,
  empty,
}: {
  error: string
  items: T[] | null
  empty: string
}) {
  if (error) return <div className="form-error public-profile-state" role="alert">{error}</div>
  if (!items) return <p className="loading-line public-profile-state">正在加载…</p>
  return (
    <div className="empty-panel public-profile-state">
      <EmptyState title={empty} description="该用户的公开记录会显示在这里。" />
    </div>
  )
}
