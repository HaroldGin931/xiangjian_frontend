import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Bell, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DetailDialog, usePanelReady } from '~/components/DetailDialog'
import { EventDetail } from '../events/EventDetail'
import { NodeDetail } from '../nodes/NodesPanel'
import { TaskDetailPage } from '../tasks/TaskDetailPage'
import { PostThreadPanel } from '../feed/PostThreadPanel'
import { UserProfilePage } from '../social/UserProfilePage'
import { authorDisplayName, formatTimestamp } from '~/lib/format'
import type { NotificationView, RiceSession } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { LoginLink } from '../session/LoginLink'
import {
  getNotifications,
  getTaskNotifications,
  markNotificationsRead,
  markTaskNotificationsRead,
  NOTIFICATIONS_READ_EVENT,
  notificationTarget,
  type NotificationTarget,
} from './api'
import { applyNotificationState, notificationSource, NOTIFICATION_STORAGE_PREFIX, saveNotificationState } from './local-state'

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
  'task-application_not_selected': { label: '任务', action: '通知你：本次任务申请未入选' },
  'task-application_rejected': { label: '任务', action: '拒绝了你的任务申请，本次申请未入选' },
  'task-task_cancelled': { label: '任务', action: '取消了你申请的任务' },
  'task-task_expired': { label: '任务', action: '你申请的任务已失效' },
  'task-result_submitted': { label: '任务', action: '提交了任务结果' },
  'task-result_approved': { label: '任务', action: '认可了你的任务结果' },
  'task-changes_requested': { label: '任务', action: '请你继续完善任务结果' },
}

export function notificationTitle(notification: NotificationView) {
  if (notification.subjectType && notification.subjectType !== 'task') return notification.text || '有新的业务通知'
  return `${authorDisplayName(notification.author)} ${reasonCopy[notification.reason]?.action || '与你有新的互动'}`
}

export function NotificationsPage({ embedded = false }: { embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  return <NotificationInbox key={session?.pds.did ?? 'guest'} session={session} isReady={isReady} embedded={embedded} />
}

function NotificationInbox({ session, isReady, embedded }: { session: RiceSession | null; isReady: boolean; embedded: boolean }) {
  const [selected, setSelected] = useState<NotificationTarget | null>(null)
  const [marking, setMarking] = useState(false)
  const [rows, setRows] = useState<NotificationView[]>([])
  const [isLoading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [, refreshLocalState] = useState(0)
  const accessJwt = session?.pds.access_jwt
  const riceToken = session?.token
  const account = session?.pds.did
  const notifications = account ? applyNotificationState(account, rows) : []
  const lifetime = useRef(0)
  usePanelReady(isReady && (!session || !isLoading))

  useEffect(() => {
    const refresh = () => refreshLocalState((value) => value + 1)
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === NOTIFICATION_STORAGE_PREFIX + account) refresh()
    }
    window.addEventListener(NOTIFICATIONS_READ_EVENT, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [account])

  useEffect(() => {
    lifetime.current += 1
    setMarking(false)
    return () => { lifetime.current += 1 }
  }, [accessJwt, riceToken])

  useEffect(() => {
    if (!isReady) return
    if (!accessJwt || !riceToken) {
      setRows([])
      setSelected(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setLoadError('')
    void Promise.allSettled([
      getNotifications({ data: accessJwt }),
      getTaskNotifications({ data: riceToken }),
    ])
      .then(([social, tasks]) => {
        if (!active) return

        const nextNotifications = [social, tasks]
          .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
          .sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
        setRows(nextNotifications)

        setLoadError(([
          ['帖子互动通知', social], ['任务、活动与社区通知', tasks],
        ] as const).flatMap(([source, result]) => result.status === 'rejected'
          ? [`${source}暂时无法加载：${result.reason instanceof Error ? result.reason.message : '请稍后重试。'}`]
          : []).join(' '))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessJwt, isReady, reloadKey, riceToken])

  const markAll = async () => {
    if (!accessJwt || !riceToken || marking) return
    const requestLifetime = lifetime.current
    setMarking(true); setError('')
    const results = await Promise.allSettled([markNotificationsRead({ data: accessJwt }), markTaskNotificationsRead({ data: riceToken })])
    if (requestLifetime !== lifetime.current) return
    setRows((current) => current.map((notification) =>
      results[notificationSource(notification) === 'social' ? 0 : 1].status === 'fulfilled'
        ? { ...notification, isRead: true } : notification))
    setError(results.flatMap((result, index) => result.status === 'rejected'
      ? [`${index === 0 ? '帖子互动通知' : '任务、活动与社区通知'}未能标记已读，请重试。`] : []).join(' '))
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
    setMarking(false)
  }

  const saveLocalState = (items: NotificationView[], state: 'read' | 'hidden') => {
    if (!account) return
    try {
      saveNotificationState(account, items, state)
      setError('')
    } catch { setError(state === 'hidden' ? '未能清除已读消息，请检查浏览器存储后重试。' : '未能保存已读状态，请检查浏览器存储后重试。') }
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  if (isReady && !session) {
    return (
      <div className={`page signed-out-state${embedded ? ' business-panel list-panel' : ''}`}>
        {!embedded && <Link to="/" className="back-link"><ArrowLeft size={18} aria-hidden="true" /> 返回广场</Link>}
        <Bell size={34} aria-hidden="true" />
        <strong>登录后查看通知</strong>
        <p>新的互动会集中显示在这里。</p>
        <LoginLink className="primary-link">前往登录</LoginLink>
      </div>
    )
  }

  return (
    <div className={`page notifications-page${embedded ? ' business-panel list-panel' : ''}`}>
      {!embedded && <Link to="/" className="back-link"><ArrowLeft size={18} aria-hidden="true" /> 返回广场</Link>}
      <div className="business-heading notification-heading">
        <div>{embedded ? <strong>全部消息</strong> : <h1>通知</h1>}{unreadCount > 0 && <span className="notification-count">{unreadCount} 条未读</span>}</div>
        <div className="notification-actions">
          <Button label={marking ? '正在标记…' : '全部已读'} variant="ghost" isDisabled={marking || !unreadCount} clickAction={markAll} />
          <Button label="清除所有已读消息" variant="ghost" isDisabled={marking || !notifications.some((notification) => notification.isRead)} clickAction={() => saveLocalState(notifications.filter((notification) => notification.isRead), 'hidden')} />
        </div>
      </div>
      {loadError || error ? (
        <div className="inline-error" role="alert">
          <span>{[loadError, error].filter(Boolean).join(' ')}</span>
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
          {notifications.map((notification) => {
            const target = notificationTarget(notification)
            return <button
              className={`notification-row ${notification.isRead ? '' : 'unread'}`}
              key={`${notificationSource(notification)}-${notification.uri}-${notification.reason}`}
              type="button"
              onClick={() => {
                if (target) setSelected(target)
                if (!notification.isRead) saveLocalState([notification], 'read')
              }}
              aria-haspopup={target ? 'dialog' : undefined}
            >
              <span className={`notification-reason reason-${notification.reason}`}>
                {notification.subjectType === 'event' ? '活动' : notification.subjectType === 'node' ? '社区' : reasonCopy[notification.reason]?.label || '互动'}
              </span>
              <span className="notification-body">
                <strong>{notificationTitle(notification)}</strong>
                {notification.text && notification.text !== notificationTitle(notification) ? <span className="notification-preview">{notification.text}</span> : null}
                <span className="notification-meta"><time dateTime={notification.indexedAt}>{formatTimestamp(notification.indexedAt)}</time>{!notification.isRead && <span className="notification-unread"><i aria-hidden="true" />未读</span>}</span>
              </span>
              {target && <ChevronRight className="notification-arrow" size={20} aria-hidden="true" />}
            </button>
          })}
        </section>
      )}
      {isLoading ? <p className="loading-line" aria-live="polite">正在加载通知…</p> : null}
      {selected && <DetailDialog title={{ task: '任务详情', event: '活动详情', node: '社区详情', post: '帖子详情', profile: '个人主页' }[selected.kind]} onClose={() => setSelected(null)}>
        {selected.kind === 'event' && <EventDetail eventId={selected.id} />}
        {selected.kind === 'node' && <NodeDetail nodeId={selected.id} />}
        {selected.kind === 'task' && <TaskDetailPage taskId={selected.id} embedded />}
        {selected.kind === 'post' && <PostThreadPanel uri={selected.uri} onPostDeleted={() => setSelected(null)} />}
        {selected.kind === 'profile' && <UserProfilePage actor={selected.actor} embedded />}
      </DetailDialog>}
    </div>
  )
}
