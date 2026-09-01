import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/features/feed/api'
import type { PostFeed } from '~/lib/models'

import { useStoredSession } from '../session/session'

export function MyPostsPage() {
  const { session, isReady } = useStoredSession()
  const [feed, setFeed] = useState<PostFeed | null>(null)
  const [error, setError] = useState('')

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
    <div className="page my-posts-page">
      <Link to="/me" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" /> 返回个人中心
      </Link>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {feed ? <PostList posts={feed.posts} /> : !error ? <p className="loading-line">正在加载帖子…</p> : null}
    </div>
  )
}
