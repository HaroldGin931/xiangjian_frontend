import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/features/feed/api'
import type { PostFeed } from '~/lib/models'
import { useStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/search')({ component: SearchPage })

function SearchPage() {
  const { session } = useStoredSession()
  const [query, setQuery] = useState('')
  const [feed, setFeed] = useState<PostFeed | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    const value = query.trim()
    if (!value) return
    setLoading(true)
    setError('')
    try {
      setFeed(
        await getPosts({
          data: {
            query: value,
            accessJwt: session?.pds.access_jwt,
            did: session?.pds.did,
          },
        }),
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page search-page">
      <header className="standalone-header">
        <Link to="/" className="back-link" aria-label="返回广场">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <label className="global-search-field">
          <span className="sr-only">全局搜索</span>
          <input
            aria-label="全局搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void search()
            }}
            placeholder="搜索"
            autoFocus
          />
          <button
            type="button"
            aria-label="提交搜索"
            onClick={search}
            disabled={!query.trim() || isLoading}
          >
            <Search size={17} aria-hidden="true" />
          </button>
        </label>
      </header>

      <div className="global-search-tabs" role="tablist" aria-label="搜索范围">
        <button type="button" className="active" role="tab" aria-selected="true">全部</button>
        <button type="button" role="tab" aria-selected="false" disabled>任务</button>
        <button type="button" role="tab" aria-selected="false">帖子</button>
        <button type="button" role="tab" aria-selected="false" disabled>人</button>
        <button type="button" role="tab" aria-selected="false" disabled>社区</button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {feed ? (
        <section className="search-results">
          <div className="result-heading">帖子 · {feed.posts.length}</div>
          <PostList posts={feed.posts} />
        </section>
      ) : (
        <p className="search-hint">输入关键词，查找真实帖子。</p>
      )}
    </div>
  )
}
