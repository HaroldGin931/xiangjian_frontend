import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { formatTimestamp } from '~/lib/format'
import type { NotificationFeed, NotificationView } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { getNotifications } from './api'

const emptyFeed: NotificationFeed = { notifications: [], priority: false }

const reasonLabels: Record<string, string> = {
  like: '点赞',
  repost: '转发',
  follow: '关注',
  mention: '提及',
  reply: '评论',
  quote: '引用',
  'subscribed-post': '帖子',
}

function notificationTitle(notification: NotificationView) {
  const author =
    notification.author.displayName || notification.author.handle.split('.')[0]
  const action: Record<string, string> = {
    like: '赞了你的帖子',
    repost: '转发了你的帖子',
    follow: '关注了你',
    mention: '在帖子中提到了你',
    reply: '回复了你的帖子',
    quote: '引用了你的帖子',
    'subscribed-post': '发布了新帖子',
  }
  return `${author} ${action[notification.reason] || '与你有新的互动'}`
}

export function NotificationsPage() {
  const { session, isReady } = useStoredSession()
  const [feed, setFeed] = useState<NotificationFeed>(emptyFeed)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const requestSequence = useRef(0)
  const accessJwt = session?.pds.access_jwt

  useEffect(() => {
    if (!isReady || !accessJwt) return
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    void getNotifications({ data: accessJwt })
      .then((nextFeed) => {
        if (requestId === requestSequence.current) setFeed(nextFeed)
      })
      .catch((reason) => {
        if (requestId === requestSequence.current) {
          setError(reason instanceof Error ? reason.message : '通知暂时无法加载')
        }
      })
      .finally(() => {
        if (requestId === requestSequence.current) setLoading(false)
      })
  }, [accessJwt, isReady, reloadKey])

  if (isReady && !session) {
    return (
      <div className="page signed-out-state">
        <Bell size={34} aria-hidden="true" />
        <strong>登录后查看通知</strong>
        <p>新的互动会集中显示在这里。</p>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  return (
    <div className="page notifications-page">
      <div className="message-tabs" role="tablist" aria-label="消息分类">
        <button type="button" className="active" role="tab" aria-selected="true">通知</button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          aria-label="私信，当前版本不提供"
          disabled
        >
          私信
        </button>
      </div>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>重试</button>
        </div>
      ) : null}

      {feed.notifications.length === 0 && !isLoading ? (
        <section className="notification-empty-state">
          <Bell size={28} aria-hidden="true" />
          <strong>暂时没有通知</strong>
          <p>点赞、转发和评论等真实互动会显示在这里。</p>
        </section>
      ) : (
        <section className="notification-list" aria-label="通知列表">
          {feed.notifications.map((notification) => (
            <article
              className={`notification-row ${notification.isRead ? '' : 'unread'}`}
              key={`${notification.uri}-${notification.reason}`}
            >
              <span className={`notification-reason reason-${notification.reason}`}>
                {reasonLabels[notification.reason] || '互动'}
              </span>
              <div className="notification-body">
                <strong>{notificationTitle(notification)}</strong>
                {notification.text ? <p>{notification.text}</p> : null}
                <time>{formatTimestamp(notification.indexedAt)}</time>
              </div>
            </article>
          ))}
        </section>
      )}
      {isLoading ? <p className="loading-line" aria-live="polite">正在加载通知…</p> : null}
    </div>
  )
}
