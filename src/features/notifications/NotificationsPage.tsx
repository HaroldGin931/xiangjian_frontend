import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'

import { authorDisplayName, formatTimestamp } from '~/lib/format'
import type { NotificationView } from '~/lib/models'

import { useStoredSession } from '../session/session'
import {
  getNotifications,
  getTaskNotifications,
  markNotificationsRead,
  markTaskNotificationsRead,
  NOTIFICATIONS_READ_EVENT,
} from './api'

const reasonCopy: Record<string, { label: string; action: string }> = {
  like: { label: '点赞', action: '赞了你的帖子' },
  repost: { label: '转发', action: '转发了你的帖子' },
  follow: { label: '关注', action: '关注了你' },
  mention: { label: '提及', action: '在帖子中提到了你' },
  reply: { label: '评论', action: '回复了你的帖子' },
  quote: { label: '引用', action: '引用了你的帖子' },
  'subscribed-post': { label: '帖子', action: '发布了新帖子' },
  'task-application_created': { label: '任务', action: '申请领取你的任务' },
  'task-assignee_appointed': { label: '任务', action: '任命你承做任务' },
  'task-application_not_selected': { label: '任务', action: '为任务任命了其他承做人' },
  'task-task_cancelled': { label: '任务', action: '取消了你申请的任务' },
  'task-task_expired': { label: '任务', action: '你申请的任务已失效' },
  'task-result_submitted': { label: '任务', action: '提交了任务结果' },
  'task-result_approved': { label: '任务', action: '认可了你的任务结果' },
  'task-changes_requested': { label: '任务', action: '请你继续完善任务结果' },
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
  const riceToken = session?.token

  useEffect(() => {
    if (!isReady || !accessJwt || !riceToken) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    void Promise.allSettled([
      getNotifications({ data: accessJwt }),
      getTaskNotifications({ data: riceToken }),
    ])
      .then(([social, tasks]) => {
        if (!active) return

        const nextNotifications = [social, tasks]
          .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
          .sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
        setNotifications(nextNotifications)

        const failures = [social, tasks].filter((result) => result.status === 'rejected')
        if (failures.length > 0) setError('部分通知暂时无法加载，请稍后重试。')

        const markRead = []
        if (social.status === 'fulfilled' && social.value.some((item) => !item.isRead)) {
          markRead.push(markNotificationsRead({ data: accessJwt }))
        }
        if (tasks.status === 'fulfilled' && tasks.value.some((item) => !item.isRead)) {
          markRead.push(markTaskNotificationsRead({ data: riceToken }))
        }
        if (markRead.length > 0) {
          void Promise.allSettled(markRead).then(() => {
            window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessJwt, isReady, reloadKey, riceToken])

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
                <strong>
                  {notification.taskId ? (
                    <Link to="/tasks/$taskId" params={{ taskId: notification.taskId }}>
                      {notificationTitle(notification)}
                    </Link>
                  ) : notificationTitle(notification)}
                </strong>
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
