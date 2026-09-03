import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useEffect, useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/features/feed/api'
import { getTasks } from '~/features/tasks/api'
import { TaskCard } from '~/features/tasks/TaskCard'
import type { RiceTask } from '~/features/tasks/types'
import { formatTimestamp } from '~/lib/format'
import type { PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { getActivityParticipations, type ActivityParticipation } from './api'

type ProfileTab = 'participated_tasks' | 'created_tasks' | 'activities' | 'posts'

const tabs: Array<{ value: ProfileTab; label: string }> = [
  { value: 'participated_tasks', label: '参与的任务' },
  { value: 'created_tasks', label: '发布的任务' },
  { value: 'activities', label: '参与的活动' },
  { value: 'posts', label: '帖子' },
]

export function PublicProfileContent({ actor }: { actor: string }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')

  return (
    <>
      <div className="social-profile-tabs" role="group" aria-label="用户公开内容">
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
      {activeTab === 'participated_tasks' ? (
        <PublicTasks actor={actor} relation="participant" />
      ) : null}
      {activeTab === 'created_tasks' ? (
        <PublicTasks actor={actor} relation="creator" />
      ) : null}
    </>
  )
}

function PublicPosts({ actor }: { actor: string }) {
  const { session } = useStoredSession()
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
  return <PostList posts={posts} />
}

function PublicTasks({
  actor,
  relation,
}: {
  actor: string
  relation: 'participant' | 'creator'
}) {
  const { session } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setTasks(null)
    setError('')
    void getTasks({
      data: {
        token: session?.token,
        ...(relation === 'participant' ? { participantDid: actor } : { creatorDid: actor }),
      },
    })
      .then((items) => { if (active) setTasks(items) })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '任务记录暂时无法显示')
      })
    return () => { active = false }
  }, [actor, relation, session])

  if (error || !tasks || tasks.length === 0) {
    return (
      <ProfileContentState
        error={error}
        items={tasks}
        empty={relation === 'participant' ? '还没有参与任务' : '还没有发布任务'}
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
  const [items, setItems] = useState<ActivityParticipation[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setItems(null)
    setError('')
    void getActivityParticipations({ data: { actor } })
      .then((result) => { if (active) setItems(result) })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '活动记录暂时无法显示')
      })
    return () => { active = false }
  }, [actor])

  if (error || !items || items.length === 0) {
    return <ProfileContentState error={error} items={items} empty="还没有参与活动" />
  }

  return (
    <section className="activity-history public-profile-list">
      {items.map((item) => (
        <div className="activity-history-item" key={item.activity.uri}>
          <small>于 {formatTimestamp(item.participatedAt)} 参与</small>
          <PostList posts={[item.activity]} />
        </div>
      ))}
    </section>
  )
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
