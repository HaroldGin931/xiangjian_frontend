import { LoginLink } from '../session/LoginLink'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { PostList } from '~/components/PostList'
import { AutoLoadMore } from '~/components/AutoLoadMore'
import { usePanelReady } from '~/components/DetailDialog'
import { LoadingState } from '~/components/LoadingState'
import { useActorPosts } from '~/features/feed/useActorPosts'
import { PostThreadDialog } from '~/features/feed/PostThreadDialog'
import { postCategory } from '~/features/feed/tags'
import type { PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'

export function MyPostsPage({ embedded = false }: { embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const { feed, error, loading, more } = useActorPosts(session?.pds.did, '帖子暂时无法加载')
  const [selectedPost, setSelectedPost] = useState<{ post: PostView; focusReply: boolean } | null>(null)
  usePanelReady(isReady && (!session || Boolean(feed || error)))

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
      {!embedded && <Link to="/me" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" /> 返回个人中心
      </Link>}
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {feed ? <PostList posts={feed.posts} onOpenPost={(post, focusReply) => setSelectedPost({ post, focusReply })} /> : !error ? <LoadingState label="正在加载帖子…" /> : null}
      {feed?.cursor && <AutoLoadMore key={session?.pds.did} cursor={feed.cursor} loading={loading} failed={!!error} onLoadMore={more} />}
      {selectedPost && <PostThreadDialog uri={selectedPost.post.uri} category={postCategory(selectedPost.post.record)} focusReply={selectedPost.focusReply} onClose={() => setSelectedPost(null)} />}
    </div>
  )
}
