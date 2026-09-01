import { useEffect, useRef, useState } from 'react'

import { PostList } from '~/components/PostList'
import type { PostFeed } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { getPosts } from './api'

type FeedTab = 'all' | 'activity' | 'product'

export function PlazaPage({ initialFeed }: { initialFeed: PostFeed }) {
  const [feed, setFeed] = useState(initialFeed)
  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const requestSequence = useRef(0)
  const { session, isReady } = useStoredSession()
  const accessJwt = session?.pds.access_jwt
  const did = session?.pds.did

  useEffect(() => {
    if (!isReady) return
    if (activeTab === 'all' && !session && reloadKey === 0) {
      setFeed(initialFeed)
      return
    }

    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    void getPosts({
      data: {
        accessJwt,
        did,
        tag:
          activeTab === 'activity'
            ? '活动'
            : activeTab === 'product'
              ? '商品'
              : undefined,
      },
    })
      .then((nextFeed) => {
        if (requestId === requestSequence.current) setFeed(nextFeed)
      })
      .catch((reason) => {
        if (requestId === requestSequence.current) {
          setError(reason instanceof Error ? reason.message : '帖子暂时无法加载')
        }
      })
      .finally(() => {
        if (requestId === requestSequence.current) setLoading(false)
      })
  }, [accessJwt, activeTab, did, initialFeed, isReady, reloadKey, session])

  return (
    <div className="page plaza-page">
      <section className="feed-toolbar" aria-label="帖子分类">
        <div className="feed-tabs" role="tablist">
          {(
            [
              ['all', '全部帖子'],
              ['activity', '活动'],
              ['product', '商品'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className={activeTab === value ? 'active' : ''}
              onClick={() => setActiveTab(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="feed-progress" aria-live="polite">
          {isLoading ? '正在更新…' : ''}
        </span>
      </section>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            重试
          </button>
        </div>
      ) : null}

      <section className="feed-section">
        <PostList posts={feed.posts} />
      </section>
    </div>
  )
}
