import { Button } from '@astryxdesign/core/Button'
import { Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { ReactNode } from 'react'

import { logoutRice } from '~/lib/api'
import { useStoredSession } from '~/lib/session'

export function AppShell({ children }: { children: ReactNode }) {
  const { session, isReady, saveSession } = useStoredSession()
  const logout = useServerFn(logoutRice)
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (session) await logout({ data: session.token }).catch(() => undefined)
    saveSession(null)
    await navigate({ to: '/login' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="返回乡建 DAO 广场">
          乡建 DAO
        </Link>
        <div className="topbar-actions">
          {isReady && session ? (
            <Button
              label="退出"
              variant="ghost"
              size="lg"
              className="header-button"
              onClick={handleLogout}
            />
          ) : (
            <Link to="/login" className="login-link">
              登录
            </Link>
          )}
        </div>
      </header>

      <main className="page-frame">{children}</main>

      <nav className="bottom-nav" aria-label="主要导航">
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
        >
          通知
        </Link>
        <Link
          to="/me"
          className="bottom-link"
          activeProps={{ className: 'bottom-link active' }}
        >
          我的
        </Link>
      </nav>
    </div>
  )
}
