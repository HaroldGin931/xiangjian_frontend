import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DetailDialog } from '~/components/DetailDialog'
import { EventDetail } from '../events/EventDetail'
import { NodeDetail } from '../nodes/NodesPanel'
import { TaskDetailPage } from '../tasks/TaskDetailPage'
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
  if (notification.subjectType && notification.subjectType !== 'task') return notification.text || '有新的业务通知'
  return `${authorDisplayName(notification.author)} ${reasonCopy[notification.reason]?.action || '与你有新的互动'}`
}

export function NotificationsPage() {
  const { session, isReady } = useStoredSession()
  const [selected, setSelected] = useState<NotificationView | null>(null)
  const [marking, setMarking] = useState(false)
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


      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessJwt, isReady, reloadKey, riceToken])

  const markAll = async () => {
    if (!accessJwt || !riceToken || marking) return
    setMarking(true); setError('')
    const results = await Promise.allSettled([markNotificationsRead({ data: accessJwt }), markTaskNotificationsRead({ data: riceToken })])
    if (results.every((r) => r.status === 'fulfilled')) { setNotifications((rows) => rows.map((n) => ({ ...n, isRead: true }))); window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT)) }
    else { setError('部分通知未能标记已读，请重试。'); setReloadKey((v) => v + 1) }
    setMarking(false)
  }

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
      <div className="business-heading"><h1>通知</h1><Button label="全部已读" variant="ghost" isDisabled={marking || !notifications.some((n) => !n.isRead)} clickAction={markAll} /></div>
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
          <p>任务、活动、社区申请与帖子互动会显示在这里。</p>
        </section>
      ) : (
        <section className="notification-list" aria-label="通知列表">
          {notifications.map((notification) => (
            <article
              className={`notification-row ${notification.isRead ? '' : 'unread'}`}
              key={`${notification.uri}-${notification.reason}`}
            >
              <span className={`notification-reason reason-${notification.reason}`}>
                {notification.subjectType === 'event' ? '活动' : notification.subjectType === 'node' ? '社区' : reasonCopy[notification.reason]?.label || '互动'}
              </span>
              <div className="notification-body">
                <strong>
                  {notification.taskId || notification.subjectId ? <button type="button" className="text-button" onClick={() => setSelected(notification)}>{notificationTitle(notification)}</button> : notificationTitle(notification)}
                </strong>
                {notification.text && notification.text !== notificationTitle(notification) ? <p>{notification.text}</p> : null}
                <time>{formatTimestamp(notification.indexedAt)}</time>
              </div>
            </article>
          ))}
        </section>
      )}
      {isLoading ? <p className="loading-line" aria-live="polite">正在加载通知…</p> : null}
      {selected && <DetailDialog title="通知详情" onClose={() => setSelected(null)}>{selected.subjectType === 'event' ? <EventDetail eventId={selected.subjectId!} /> : selected.subjectType === 'node' ? <NodeDetail nodeId={selected.subjectId!} /> : <TaskDetailPage taskId={selected.taskId || selected.subjectId!} embedded />}</DetailDialog>}
    </div>
  )
}
