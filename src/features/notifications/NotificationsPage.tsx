import { Button } from '@astryxdesign/core/Button'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'

import { authorDisplayName, formatTimestamp } from '~/lib/format'
import type { NotificationView } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { getNotifications } from './api'

const reasonCopy: Record<string, { label: string; action: string }> = {
  like: { label: '点赞', action: '赞了你的帖子' },
  repost: { label: '转发', action: '转发了你的帖子' },
  follow: { label: '关注', action: '关注了你' },
  mention: { label: '提及', action: '在帖子中提到了你' },
  reply: { label: '评论', action: '回复了你的帖子' },
  quote: { label: '引用', action: '引用了你的帖子' },
  'subscribed-post': { label: '帖子', action: '发布了新帖子' },
}

function notificationTitle(notification: NotificationView) {
  return `${authorDisplayName(notification.author)} ${reasonCopy[notification.reason]?.action || '与你有新的互动'}`
}

export function NotificationsPage() {
  const { session, isReady } = useStoredSession()
  const [notifications, setNotifications] = useState<NotificationView[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const accessJwt = session?.pds.access_jwt

  useEffect(() => {
    if (!isReady || !accessJwt) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    void getNotifications({ data: accessJwt })
      .then((nextNotifications) => {
        if (active) setNotifications(nextNotifications)
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : '通知暂时无法加载')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
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
      <div className="message-tabs">
        <SegmentedControl label="消息分类" value="notifications" onChange={() => undefined} size="sm">
          <SegmentedControlItem value="notifications" label="通知" />
          <SegmentedControlItem value="direct-messages" label="私信" isDisabled />
        </SegmentedControl>
      </div>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <Button label="重试" variant="ghost" size="sm" onClick={() => setReloadKey((value) => value + 1)} />
        </div>
      ) : null}

      {notifications.length === 0 && !isLoading ? (
        <section className="notification-empty-state">
          <Bell size={28} aria-hidden="true" />
          <strong>暂时没有通知</strong>
          <p>点赞、转发和评论等真实互动会显示在这里。</p>
        </section>
      ) : (
        <section className="notification-list" aria-label="通知列表">
          {notifications.map((notification) => (
            <article
              className={`notification-row ${notification.isRead ? '' : 'unread'}`}
              key={`${notification.uri}-${notification.reason}`}
            >
              <span className={`notification-reason reason-${notification.reason}`}>
                {reasonCopy[notification.reason]?.label || '互动'}
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
