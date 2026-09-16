import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { Bell, Search } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  getNotifications,
  getTaskNotifications,
  NOTIFICATIONS_READ_EVENT,
} from '~/features/notifications/api'
import { NotificationsPage } from '~/features/notifications/NotificationsPage'
import { DetailDialog } from './DetailDialog'
import { LoadingProgress } from './LoadingProgress'
import { ComposePanel, type ComposeKind } from '~/features/feed/ComposePanel'
import { useStoredSession } from '~/features/session/session'

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { session, isReady, recoveryError } = useStoredSession()
  const previousSession = useRef<{ accountId?: string; token?: string } | null>(null)
  const [compose, setCompose] = useState<ComposeKind | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const pathname = useRouterState({ select: (state) => (state.resolvedLocation ?? state.location).pathname })
  const navigating = useRouterState({ select: (state) => state.isLoading && state.location.href !== state.resolvedLocation?.href })
  const href = useRouterState({ select: (state) => state.location.href })
  useEffect(() => {
    const refresh = () => { void router.invalidate({ filter: (match) => ['/tasks/', '/events', '/me/'].includes(match.routeId) }) }
    window.addEventListener('rice-changed', refresh)
    return () => window.removeEventListener('rice-changed', refresh)
  }, [router])
  useEffect(() => {
    if (!isReady) return
    const previous = previousSession.current
    if (previous && (previous.accountId !== session?.user.id || previous.token !== session?.token)) {
      router.clearCache({ filter: (match) => match.routeId === '/me/' })
      void router.invalidate({ filter: (match) => match.routeId === '/me/' })
    }
    previousSession.current = { accountId: session?.user.id, token: session?.token }
  }, [router, isReady, session?.user.id, session?.token])
  const isStandalone =
    ['/login', '/register', '/forgot-password', '/post', '/search', '/compose'].includes(pathname) ||
    pathname.startsWith('/tasks/') ||
    pathname.startsWith('/profile/')


  useEffect(() => {
    setNotificationsOpen(false)
    setCompose(null)
  }, [href, session?.user.id])

  useEffect(() => {
    if (!session) {
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
  }, [session?.token, session?.pds?.access_jwt])

  return (
    <div className={`app-shell ${isStandalone ? 'standalone-shell' : ''}`}>
      <div className="test-environment">测试环境 · 仅使用测试稻米</div>
      {!isStandalone ? <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="返回乡建 DAO 广场">
            <span>乡建</span><small>DAO</small>
          </Link>
          <div className="topbar-actions">
            {!isReady && <span className="session-placeholder" aria-hidden="true" />}
            {isReady && session && <button type="button" className="header-publish" onClick={() => setCompose(pathname === '/tasks' ? 'task' : pathname === '/events' ? 'activity' : 'post')}>发布</button>}
            {isReady && !session && <Link to="/login" className="header-publish">登录</Link>}
            <Link to="/search" className="header-search" aria-label="搜索帖子、任务、活动、社区、用户"><Search size={22} aria-hidden="true" /></Link>
            {isReady && session && <button type="button" className="header-search notification-trigger" aria-label={hasUnreadNotifications ? '通知，有新消息' : '通知'} aria-haspopup="dialog" onClick={() => setNotificationsOpen(true)}><Bell size={22} aria-hidden="true" />{hasUnreadNotifications && <i className="notification-dot" aria-hidden="true" />}</button>}
          </div>
        </div>
      </header> : null}

      <main key={session?.user.id ?? 'guest'} className="page-frame">{recoveryError && <p className="inline-error" role="alert">{recoveryError}</p>}{isReady ? children : <div className="page initial-loading" aria-busy="true"><span className="visually-hidden" role="status">正在恢复登录状态</span></div>}</main>
      {navigating && <LoadingProgress label="正在加载页面…" />}

      {!isStandalone ? <nav className="bottom-nav" aria-label="主要导航">
        <Link to="/" activeProps={{}} className={`bottom-link${pathname === '/' ? ' active' : ''}`}>
          广场
        </Link>
        <Link
          to="/tasks"
          activeProps={{}}
          className={`bottom-link${pathname.startsWith('/tasks') ? ' active' : ''}`}
        >
          任务
        </Link>
        <Link to="/events" activeProps={{}} className={`bottom-link${pathname.startsWith('/events') ? ' active' : ''}`}>活动</Link>
        <Link
          to="/me"
          activeProps={{}}
          className={`bottom-link${pathname.startsWith('/me') ? ' active' : ''}`}
        >
          我的
        </Link>
      </nav> : null}
      {session && compose && <DetailDialog title="发布" onClose={() => setCompose(null)}><ComposePanel key={session?.user.id ?? 'guest'} initialKind={compose} onPublished={() => setCompose(null)} /></DetailDialog>}
      {session && notificationsOpen && <DetailDialog title="通知" onClose={() => setNotificationsOpen(false)}><NotificationsPage key={session?.user.id ?? 'guest'} embedded /></DetailDialog>}
    </div>
  )
}
