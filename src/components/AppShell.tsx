import { Link, useRouterState } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isStandalone = ['/login', '/post', '/search', '/compose'].includes(pathname)
  const sectionTitle = pathname.startsWith('/tasks')
    ? '任务'
    : pathname.startsWith('/notifications')
      ? '消息'
      : pathname === '/me/posts'
        ? '我的帖子'
        : pathname.startsWith('/me')
          ? '我的'
          : null

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
              <Link className="header-publish" to="/compose">
                <Plus size={18} aria-hidden="true" />
                发布
              </Link>
              <Link to="/search" className="header-search" aria-label="搜索">
                <Search size={22} aria-hidden="true" />
              </Link>
            </div>
          ) : pathname.startsWith('/tasks') ? (
            <button
              type="button"
              className="header-publish disabled-control"
              aria-label="发布任务，接口尚未接入"
              disabled
            >
              <Plus size={18} aria-hidden="true" /> 发布任务
            </button>
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
        >
          消息
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
