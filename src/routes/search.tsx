import { IconButton } from '@astryxdesign/core/IconButton'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { TextInput } from '@astryxdesign/core/TextInput'
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
        <div className="global-search-field">
          <TextInput
            label="全局搜索"
            isLabelHidden
            value={query}
            onChange={setQuery}
            onEnter={search}
            placeholder="搜索"
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

      <div className="global-search-tabs">
        <SegmentedControl label="搜索范围" value="post" onChange={() => undefined} size="sm">
          <SegmentedControlItem value="all" label="全部" isDisabled />
          <SegmentedControlItem value="task" label="任务" isDisabled />
          <SegmentedControlItem value="post" label="帖子" />
          <SegmentedControlItem value="person" label="人" isDisabled />
          <SegmentedControlItem value="community" label="社区" isDisabled />
        </SegmentedControl>
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
