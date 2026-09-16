import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/features/feed/api'
import { PostThreadDialog } from '~/features/feed/PostThreadDialog'
import { postCategory } from '~/features/feed/tags'
import type { PostFeed, PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'

export function MyPostsPage({ embedded = false }: { embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const [feed, setFeed] = useState<PostFeed | null>(null)
  const [error, setError] = useState('')
  const [selectedPost, setSelectedPost] = useState<{ post: PostView; focusReply: boolean } | null>(null)

  useEffect(() => {
    if (!session) return
    setError('')
    void getPosts({
      data: {
        repo: session.pds.did,
        did: session.pds.did,
        accessJwt: session.pds.access_jwt,
      },
    })
      .then(setFeed)
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : '帖子暂时无法加载')
      })
  }, [session])

  if (isReady && !session) {
    return (
      <div className="page signed-out-state">
        <strong>登录后查看我的帖子</strong>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  return (
    <div className={`page my-posts-page${embedded ? ' business-panel' : ''}`}>
      {!embedded && <Link to="/me" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" /> 返回个人中心
      </Link>}
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {feed ? <PostList posts={feed.posts} onOpenPost={(post, focusReply) => setSelectedPost({ post, focusReply })} /> : !error ? <p className="loading-line">正在加载帖子…</p> : null}
      {selectedPost && <PostThreadDialog uri={selectedPost.post.uri} category={postCategory(selectedPost.post.record)} focusReply={selectedPost.focusReply} onClose={() => setSelectedPost(null)} />}
    </div>
  )
}
