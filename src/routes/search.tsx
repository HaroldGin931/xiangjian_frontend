import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/features/feed/api'
import { getTasks } from '~/features/tasks/api'
import { TaskCard } from '~/features/tasks/TaskCard'
import type { RiceTask } from '~/features/tasks/types'
import type { PostFeed } from '~/lib/models'
import { useStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/search')({ component: SearchPage })

type SearchScope = 'all' | 'posts' | 'tasks'

function SearchPage() {
  const { session } = useStoredSession()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [feed, setFeed] = useState<PostFeed | null>(null)
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    const value = query.trim()
    if (!value) return
    setLoading(true)
    setError('')
    try {
      const [postResult, taskResult] = await Promise.allSettled([
        getPosts({
          data: {
            query: value,
            accessJwt: session?.pds.access_jwt,
            did: session?.pds.did,
          },
        }),
        getTasks({ data: { token: session?.token, q: value } }),
      ])
      setFeed(postResult.status === 'fulfilled' ? postResult.value : { posts: [] })
      setTasks(taskResult.status === 'fulfilled' ? taskResult.value : [])
      const failures = [postResult, taskResult].filter((result) => result.status === 'rejected')
      if (failures.length) setError(failures.length === 2 ? '搜索暂时不可用' : '部分搜索结果暂时无法显示')
    } finally {
      setHasSearched(true)
      setLoading(false)
    }
  }

  return (
    <div className="page search-page">
      <header className="standalone-header">
        <Link to="/" className="back-link" aria-label="返回广场">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="global-search-field">
          <TextInput
            label="全局搜索"
            isLabelHidden
            value={query}
            onChange={setQuery}
            onEnter={search}
            placeholder="搜索帖子或任务"
            hasAutoFocus
            hasClear
            width="100%"
          />
          <IconButton
            label="提交搜索"
            icon={<Search size={17} aria-hidden="true" />}
            variant="primary"
            clickAction={search}
            isLoading={isLoading}
            isDisabled={!query.trim()}
          />
        </div>
      </header>

      <div className="global-search-tabs filter-buttons" role="group" aria-label="搜索范围">
        {([
          ['all', '全部'],
          ['posts', '帖子'],
          ['tasks', '任务'],
        ] as const).map(([value, label]) => (
          <Button
            label={label}
            variant="ghost"
            size="sm"
            className={scope === value ? 'active' : undefined}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            key={value}
          />
        ))}
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {hasSearched ? (
        <>
          {(scope === 'all' || scope === 'posts') && feed?.posts.length ? (
            <section className="search-results">
              <div className="result-heading">帖子 · {feed.posts.length}</div>
              <PostList posts={feed.posts} />
            </section>
          ) : null}
          {(scope === 'all' || scope === 'tasks') && tasks.length ? (
            <section className="search-results">
              <div className="result-heading">任务 · {tasks.length}</div>
              <div className="task-list search-task-list">
                {tasks.map((task) => <TaskCard task={task} key={task.id} />)}
              </div>
            </section>
          ) : null}
          {!error && (scope === 'posts' ? !feed?.posts.length : scope === 'tasks' ? !tasks.length : !feed?.posts.length && !tasks.length) ? (
            <p className="search-hint">没有找到相关内容，换一个关键词试试。</p>
          ) : null}
        </>
      ) : (
        <p className="search-hint">输入关键词，查找帖子和任务。</p>
      )}
    </div>
  )
}
