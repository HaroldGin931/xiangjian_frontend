import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'

import { PostList } from '~/components/PostList'
import { getPosts } from '~/lib/api'
import type { PostFeed } from '~/lib/models'
import { useStoredSession } from '~/lib/session'

export const Route = createFileRoute('/')({
  loader: () => getPosts({ data: {} }),
  component: PlazaPage,
})

function PlazaPage() {
  const initialFeed = Route.useLoaderData()
  const [feed, setFeed] = useState<PostFeed>(initialFeed)
  const [activeTab, setActiveTab] = useState<'all' | 'activity' | 'product'>('all')
  const { session, isReady } = useStoredSession()
  const fetchPosts = useServerFn(getPosts)

  useEffect(() => setFeed(initialFeed), [initialFeed])

  useEffect(() => {
    if (!session) return
    void fetchPosts({
      data: {
        accessJwt: session.pds.access_jwt,
        did: session.pds.did,
        tag:
          activeTab === 'activity'
            ? '活动'
            : activeTab === 'product'
              ? '商品'
              : undefined,
      },
    }).then(setFeed)
  }, [activeTab, fetchPosts, session])

  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab)
  }

  return (
    <div className="page plaza-page">
      <section className="feed-toolbar" aria-label="帖子分类">
        <div className="feed-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={activeTab === 'all' ? 'active' : ''}
            onClick={() => selectTab('all')}
          >
            全部帖子
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'activity'}
            className={activeTab === 'activity' ? 'active' : ''}
            onClick={() => selectTab('activity')}
          >
            活动
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'product'}
            className={activeTab === 'product' ? 'active' : ''}
            onClick={() => selectTab('product')}
          >
            商品
          </button>
        </div>
      </section>

      <section className="feed-section">
        <PostList posts={feed.posts} />
      </section>

      {!isReady ? <span className="sr-only">正在加载登录状态</span> : null}
    </div>
  )
}
