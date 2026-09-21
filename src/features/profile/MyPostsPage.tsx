import { LoginLink } from '../session/LoginLink'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PostList } from '~/components/PostList'
import { AutoLoadMore } from '~/components/AutoLoadMore'
import { usePanelReady } from '~/components/DetailDialog'
import { getPosts } from '~/features/feed/api'
import { PostThreadDialog } from '~/features/feed/PostThreadDialog'
import { postCategory } from '~/features/feed/tags'
import type { PostFeed, PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'

export function MyPostsPage({ embedded = false }: { embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const [feed, setFeed] = useState<PostFeed | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
  const [selectedPost, setSelectedPost] = useState<{ post: PostView; focusReply: boolean } | null>(null)
  usePanelReady(isReady && (!session || Boolean(feed || error)))

  useEffect(() => {
    request.current++
    setFeed(null)
    setLoading(false)
    if (!session) return
    let active = true
    setError('')
    void getPosts({
      data: {
        repo: session.pds.did,
        did: session.pds.did,
        accessJwt: session.pds.access_jwt,
      },
    })
      .then((next) => { if (active) setFeed(next) })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '帖子暂时无法加载')
      })
    return () => { active = false; request.current++ }
  }, [session?.pds.did, session?.pds.access_jwt])

  const more = async () => {
    if (!session || !feed?.cursor || loading) return
    const current = request.current
    setLoading(true)
    setError('')
    try {
      const page = await getPosts({ data: { repo: session.pds.did, did: session.pds.did, accessJwt: session.pds.access_jwt, cursor: feed.cursor } })
      if (current === request.current) setFeed((previous) => ({ ...page, posts: [...new Map([...(previous?.posts ?? []), ...page.posts].map((post) => [post.uri, post])).values()] }))
    } catch (reason) {
      if (current === request.current) setError(reason instanceof Error ? reason.message : '帖子暂时无法加载')
    } finally { if (current === request.current) setLoading(false) }
  }

  if (isReady && !session) {
    return (
      <div className="page signed-out-state">
        <strong>登录后查看我的帖子</strong>
        <LoginLink className="primary-link">前往登录</LoginLink>
      </div>
    )
  }

  return (
    <div className={`page my-posts-page${embedded ? ' business-panel list-panel' : ''}`}>
      {embedded && <h1>我的帖子</h1>}
      {!embedded && <Link to="/me" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" /> 返回个人中心
      </Link>}
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {feed ? <PostList posts={feed.posts} onOpenPost={(post, focusReply) => setSelectedPost({ post, focusReply })} /> : !error ? <p className="loading-line">正在加载帖子…</p> : null}
      {feed?.cursor && <AutoLoadMore key={session?.pds.did} cursor={feed.cursor} loading={loading} failed={!!error} onLoadMore={more} />}
      {selectedPost && <PostThreadDialog uri={selectedPost.post.uri} category={postCategory(selectedPost.post.record)} focusReply={selectedPost.focusReply} onClose={() => setSelectedPost(null)} />}
    </div>
  )
}
