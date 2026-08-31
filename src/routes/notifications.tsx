import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Bell, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { getNotifications } from '~/lib/api'
import type { NotificationFeed, NotificationView } from '~/lib/models'
import { useStoredSession } from '~/lib/session'

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
})

const emptyFeed: NotificationFeed = {
  notifications: [],
  priority: false,
}

function notificationTitle(notification: NotificationView) {
  const author =
    notification.author.displayName || notification.author.handle.split('.')[0]

  switch (notification.reason) {
    case 'like':
      return `${author} 赞了你的帖子`
    case 'repost':
      return `${author} 转发了你的帖子`
    case 'follow':
      return `${author} 关注了你`
    case 'mention':
      return `${author} 在帖子中提到了你`
    case 'reply':
      return `${author} 回复了你的帖子`
    case 'quote':
      return `${author} 引用了你的帖子`
    case 'subscribed-post':
      return `${author} 发布了新帖子`
    default:
      return `${author} 与你有新的互动`
  }
}

function notificationCopy(notification: NotificationView) {
  return notification.text
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function NotificationsPage() {
  const { session, isReady } = useStoredSession()
  const fetchNotifications = useServerFn(getNotifications)
  const [feed, setFeed] = useState<NotificationFeed>(emptyFeed)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      setFeed(await fetchNotifications({ data: session.pds.access_jwt }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '通知暂时无法加载')
    } finally {
      setLoading(false)
    }
  }, [fetchNotifications, session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (isReady && !session) {
    return (
      <div className="page narrow-page">
        <div className="empty-panel account-empty">
          <EmptyState
            icon={<Bell size={34} />}
            title="登录后查看通知"
            description="互动与任务进展会集中显示在这里。"
            actions={<Button label="前往登录" variant="primary" href="/login" />}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="page-intro intro-with-action">
        <div>
          <div className="eyebrow">与你有关</div>
          <h1>通知</h1>
          <p>查看关注、互动与任务进展。</p>
        </div>
        <Button
          label="刷新"
          variant="ghost"
          size="lg"
          isLoading={isLoading}
          onClick={refresh}
          icon={<RefreshCw size={18} />}
        />
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      {feed.notifications.length === 0 && !isLoading ? (
        <div className="empty-panel notification-empty">
          <EmptyState
            icon={<Bell size={34} />}
            title="暂时没有通知"
            description="新的互动会显示在这里。"
          />
        </div>
      ) : (
        <section className="notification-list" aria-label="通知列表">
          {feed.notifications.map((notification) => {
            const copy = notificationCopy(notification)
            return (
              <article
                className={`notification-row ${notification.isRead ? '' : 'unread'}`}
                key={`${notification.uri}-${notification.reason}`}
              >
                <div className="notification-icon" aria-hidden="true">
                  <Bell size={20} />
                </div>
                <div className="notification-body">
                  <strong>{notificationTitle(notification)}</strong>
                  {copy ? <p>{copy}</p> : null}
                  <span>{formatTime(notification.indexedAt)}</span>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
