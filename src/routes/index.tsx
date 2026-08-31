import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { BadgeInfo, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PendingPost, PostList } from '~/components/PostList'
import { createTextPost, getPosts } from '~/lib/api'
import type { PostFeed } from '~/lib/models'
import { useStoredSession } from '~/lib/session'

export const Route = createFileRoute('/')({
  loader: () => getPosts({ data: {} }),
  component: PlazaPage,
})

function PlazaPage() {
  const initialFeed = Route.useLoaderData()
  const [feed, setFeed] = useState<PostFeed>(initialFeed)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isComposerOpen, setComposerOpen] = useState(false)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<{ uri: string; text: string } | null>(null)
  const [notice, setNotice] = useState('')
  const { session, isReady } = useStoredSession()
  const fetchPosts = useServerFn(getPosts)
  const publish = useServerFn(createTextPost)
  const navigate = useNavigate()

  useEffect(() => setFeed(initialFeed), [initialFeed])

  const runSearch = async () => {
    setIsSearching(true)
    setNotice('')
    try {
      setFeed(await fetchPosts({ data: { query } }))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '搜索失败')
    } finally {
      setIsSearching(false)
    }
  }

  const refreshFeed = async () => {
    setQuery('')
    setFeed(await fetchPosts({ data: {} }))
    setNotice('已刷新')
  }

  const openComposer = async () => {
    if (!session) {
      await navigate({ to: '/login' })
      return
    }
    setComposerOpen((value) => !value)
  }

  const submitPost = async () => {
    if (!session || !text.trim()) return
    setNotice('')
    try {
      const result = await publish({
        data: {
          did: session.pds.did,
          accessJwt: session.pds.access_jwt,
          text,
        },
      })
      setPending({ uri: result.uri, text: result.text })
      setText('')
      setComposerOpen(false)
      setNotice('发布成功，内容正在同步。')

      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000))
        const next = await fetchPosts({ data: {} })
        setFeed(next)
        if (next.posts.some((post) => post.uri === result.uri)) {
          setPending(null)
          setNotice('发布成功。')
          return
        }
      }
      setNotice('内容已经发布，稍后刷新即可看到。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '发布失败')
    }
  }

  return (
    <div className="page plaza-page">
      <section className="page-intro intro-with-action">
        <div>
          <div className="eyebrow">乡建社区</div>
          <h1>广场</h1>
          <p>分享乡村生活，发现身边的人和事。</p>
        </div>
        <div className="primary-action-block">
          <Button
            label={session ? '发布内容' : '登录后发布'}
            variant="primary"
            size="lg"
            className="pill-button"
            onClick={openComposer}
          />
          <span>{session ? '分享此刻的想法' : '登录后即可发布'}</span>
        </div>
      </section>

      {isComposerOpen ? (
        <section className="composer-panel">
          <TextArea
            label="发布文字帖"
            description="记录你此刻想分享的内容，最多 300 字。"
            value={text}
            onChange={setText}
            rows={5}
            maxLength={300}
            width="100%"
            hasAutoFocus
          />
          <div className="composer-actions">
            <Button label="取消" variant="ghost" onClick={() => setComposerOpen(false)} />
            <Button
              label="发布"
              variant="primary"
              isDisabled={!text.trim() || text.length > 300}
              clickAction={submitPost}
            />
          </div>
        </section>
      ) : null}

      <section className="info-strip">
        <BadgeInfo size={30} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <strong>发现新的共建机会</strong>
          <p>浏览社区发布的任务，找到适合你的参与方式。</p>
        </div>
        <Button label="查看任务" variant="primary" size="lg" href="/tasks" className="strip-button" />
      </section>

      <section className="search-section">
        <TextInput
          label="搜索帖子"
          value={query}
          onChange={setQuery}
          placeholder="输入帖子关键词"
          width="100%"
          onEnter={runSearch}
          hasClear
          className="search-field"
        />
        <Button
          label="搜索"
          size="lg"
          className="search-button"
          clickAction={runSearch}
          isLoading={isSearching}
        />
      </section>

      {notice ? <div className="status-line">{notice}</div> : null}

      <section className="feed-section">
        <div className="section-heading">
          <h2>社区动态</h2>
          <div className="section-links">
            <button type="button" className="text-action" onClick={refreshFeed}>
              <RefreshCw size={17} aria-hidden="true" /> 刷新
            </button>
          </div>
        </div>
        {pending && session ? (
          <PendingPost handle={session.user.handle} text={pending.text} />
        ) : null}
        <PostList posts={feed.posts} />
      </section>

      {!isReady ? <span className="sr-only">正在加载登录状态</span> : null}
    </div>
  )
}
