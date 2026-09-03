import { Button } from '@astryxdesign/core/Button'
import { Link, useRouterState } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import {
  getNotifications,
  getTaskNotifications,
  NOTIFICATIONS_READ_EVENT,
} from '~/features/notifications/api'
import { useStoredSession } from '~/features/session/session'

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useStoredSession()
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isStandalone =
    ['/login', '/register', '/forgot-password', '/post', '/search', '/compose'].includes(pathname) ||
    pathname.startsWith('/tasks/') ||
    pathname.startsWith('/profile/')
  const sectionTitle = pathname.startsWith('/tasks')
    ? '任务'
    : pathname.startsWith('/notifications')
      ? '消息'
      : pathname === '/me/posts'
        ? '我的帖子'
        : pathname.startsWith('/me')
          ? '我的'
          : null

  useEffect(() => {
    if (!session || pathname.startsWith('/notifications')) {
      setHasUnreadNotifications(false)
      return
    }

    let active = true
    const refresh = async () => {
      const results = await Promise.allSettled([
        getNotifications({ data: session.pds.access_jwt }),
        getTaskNotifications({ data: session.token }),
      ])
      if (!active) return

      const hasUnread = results.some(
        (result) =>
          result.status === 'fulfilled' && result.value.some((item) => !item.isRead),
      )
      if (hasUnread || results.every((result) => result.status === 'fulfilled')) {
        setHasUnreadNotifications(hasUnread)
      }
    }
    const clear = () => setHasUnreadNotifications(false)

    void refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener(NOTIFICATIONS_READ_EVENT, clear)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, clear)
    }
  }, [pathname, session])

  return (
    <div className={`app-shell ${isStandalone ? 'standalone-shell' : ''}`}>
      {!isStandalone ? <header className="topbar">
        <div className="topbar-inner">
          {sectionTitle ? (
            <strong className="section-title">{sectionTitle}</strong>
          ) : (
            <Link to="/" className="brand" aria-label="返回乡建 DAO 广场">
              <span>乡建</span><small>DAO</small>
            </Link>
          )}
          {pathname === '/' ? (
            <div className="topbar-actions">
              <Link className="header-publish" to="/compose" search={{ kind: undefined }}>
                <Plus size={18} aria-hidden="true" />
                发布
              </Link>
              <Link to="/search" className="header-search" aria-label="搜索">
                <Search size={22} aria-hidden="true" />
              </Link>
            </div>
          ) : pathname === '/tasks' ? (
            <div className="topbar-actions">
              {session?.user.can_publish_tasks ? (
                <Link to="/compose" search={{ kind: 'task' }} className="header-publish">
                  <Plus size={18} aria-hidden="true" /> 发布
                </Link>
              ) : (
                <Button
                  label="暂无发布权限"
                  icon={<Plus size={18} aria-hidden="true" />}
                  variant="primary"
                  size="sm"
                  isDisabled
                  tooltip="任务发布者需要管理员授权"
                />
              )}
              <Link to="/search" className="header-search" aria-label="搜索">
                <Search size={22} aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </div>
      </header> : null}

      <main className="page-frame">{children}</main>

      {!isStandalone ? <nav className="bottom-nav" aria-label="主要导航">
        <Link to="/" className="bottom-link" activeProps={{ className: 'bottom-link active' }}>
          广场
        </Link>
        <Link
          to="/tasks"
          className="bottom-link"
          activeProps={{ className: 'bottom-link active' }}
        >
          任务
        </Link>
        <Link
          to="/notifications"
          className="bottom-link"
          activeProps={{ className: 'bottom-link active' }}
          aria-label={hasUnreadNotifications ? '消息，有新通知' : '消息'}
        >
          <span className="bottom-link-label">
            消息
            {hasUnreadNotifications ? <i className="notification-dot" aria-hidden="true" /> : null}
          </span>
        </Link>
        <Link
          to="/me"
          className="bottom-link"
          activeProps={{ className: 'bottom-link active' }}
        >
          我的
        </Link>
      </nav> : null}
    </div>
  )
}
