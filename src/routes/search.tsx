import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PostCard } from '~/components/PostList'
import { getPostPage } from '~/features/feed/api'
import {
  createSearchTimeline,
  takeSearchPage,
  type SearchItem,
  type SearchScope,
  type SearchTimelineState,
} from '~/features/search/timeline'
import { useStoredSession } from '~/features/session/session'
import { getTaskPage } from '~/features/tasks/api'
import { TaskCard } from '~/features/tasks/TaskCard'

export const Route = createFileRoute('/search')({ component: SearchPage })

const pageSize = 10

function SearchPage() {
  const { session } = useStoredSession()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [items, setItems] = useState<SearchItem[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [isLoadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const timeline = useRef<SearchTimelineState | null>(null)
  const activeQuery = useRef('')
  const loadMoreMarker = useRef<HTMLDivElement | null>(null)
  const requestVersion = useRef(0)

  const loaders = (value: string) => ({
    posts: async (cursor?: string) => {
      const page = await getPostPage({
        data: {
          query: value,
          cursor,
          limit: pageSize,
          accessJwt: session?.pds.access_jwt,
          did: session?.pds.did,
        },
      })
      return { items: page.posts, nextCursor: page.cursor }
    },
    tasks: async (cursor?: string) => {
      const page = await getTaskPage({
        data: {
          token: session?.token,
          q: value,
          sort: 'published',
          before: cursor,
          limit: pageSize,
        },
      })
      return { items: page.data, nextCursor: page.meta.next_cursor }
    },
  })

  const search = async (selectedScope = scope) => {
    const value = query.trim()
    if (!value) return
    const version = ++requestVersion.current
    activeQuery.current = value
    timeline.current = null
    setLoading(true)
    setLoadingMore(false)
    setItems([])
    setHasMore(false)
    setError('')
    try {
      const page = await takeSearchPage(
        createSearchTimeline(selectedScope),
        loaders(value),
        pageSize,
      )
      if (version !== requestVersion.current) return
      timeline.current = page.state
      setItems(page.items)
      setHasMore(page.hasMore)
    } catch (reason) {
      if (version === requestVersion.current) {
        timeline.current = null
        setError(reason instanceof Error ? reason.message : '搜索暂时不可用')
      }
    } finally {
      if (version === requestVersion.current) {
        setHasSearched(true)
        setLoading(false)
      }
    }
  }

  const loadMore = async () => {
    const current = timeline.current
    if (!current || !hasMore || isLoadingMore) return
    const version = requestVersion.current
    setLoadingMore(true)
    setError('')
    try {
      const page = await takeSearchPage(current, loaders(activeQuery.current), pageSize)
      if (version !== requestVersion.current) return
      timeline.current = page.state
      setItems((existing) => [...existing, ...page.items])
      setHasMore(page.hasMore)
    } catch (reason) {
      if (version === requestVersion.current) {
        setError(reason instanceof Error ? reason.message : '更多结果暂时无法加载')
      }
    } finally {
      if (version === requestVersion.current) setLoadingMore(false)
    }
  }

  useEffect(() => {
    const marker = loadMoreMarker.current
    if (!marker || !hasMore || isLoading || isLoadingMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { rootMargin: '240px 0px' },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [hasMore, isLoading, isLoadingMore, items.length])

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
            onEnter={() => void search()}
            placeholder="搜索帖子或任务"
            hasAutoFocus
            hasClear
            width="100%"
          />
          <IconButton
            label="提交搜索"
            icon={<Search size={17} aria-hidden="true" />}
            variant="primary"
            clickAction={() => void search()}
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
            onClick={() => {
              setScope(value)
              if (hasSearched && value !== scope) void search(value)
            }}
            key={value}
          />
        ))}
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {isLoading ? <div className="loading-line">正在搜索…</div> : null}
      {hasSearched ? (
        <>
          {items.length ? (
            <section className="search-results" aria-label="搜索结果" aria-busy={isLoadingMore}>
              <div className="post-list search-stream">
                {items.map((item) => item.kind === 'post' ? (
                  <PostCard
                    post={item.post}
                    onPostDeleted={(uri) => setItems((current) => current.filter(
                      (result) => result.kind !== 'post' || result.post.uri !== uri,
                    ))}
                    key={`post:${item.post.reason?.uri ?? item.post.uri}`}
                  />
                ) : (
                  <TaskCard task={item.task} key={`task:${item.task.id}`} />
                ))}
              </div>
            </section>
          ) : null}
          {!isLoading && !error && !items.length ? (
            <p className="search-hint">没有找到相关内容，换一个关键词试试。</p>
          ) : null}
          <div ref={loadMoreMarker} className="search-load-marker" aria-hidden="true" />
          {isLoadingMore ? <div className="loading-line">正在加载更早的结果…</div> : null}
        </>
      ) : (
        <p className="search-hint">输入关键词，查找帖子和任务。</p>
      )}
    </div>
  )
}
