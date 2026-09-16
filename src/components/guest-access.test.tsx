import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostView, RiceSession } from '~/lib/models'

const state = vi.hoisted(() => ({ session: null as RiceSession | null, pathname: '/' }))
vi.mock('~/features/session/session', () => ({ useStoredSession: () => ({ session: state.session, isReady: true, saveSession: vi.fn() }) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, 'aria-label': label }: { children: ReactNode; to: string; className?: string; 'aria-label'?: string }) => <a href={to} className={className} aria-label={label}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string; href: string } }) => unknown }) => select({ location: { pathname: state.pathname, href: state.pathname } }),
}))
vi.mock('~/features/notifications/api', () => ({ getNotifications: vi.fn(), getTaskNotifications: vi.fn(), NOTIFICATIONS_READ_EVENT: 'read' }))
vi.mock('~/features/notifications/NotificationsPage', () => ({ NotificationsPage: () => null }))
vi.mock('~/features/feed/ComposePanel', () => ({ ComposePanel: () => null }))
vi.mock('~/features/feed/api', () => ({ clearCachedFeed: vi.fn(), deletePost: vi.fn(), hideDeletedPost: vi.fn(), toggleLike: vi.fn(), toggleRepost: vi.fn() }))

import { AppShell } from './AppShell'
import { PostActions } from './PostActions'

beforeEach(() => { state.session = null; state.pathname = '/' })

describe('guest access', () => {
  it.each(['/', '/tasks', '/events'])('shows login and public navigation without publishing or notifications on %s', (pathname) => {
    state.pathname = pathname
    const html = renderToStaticMarkup(<AppShell><p>public content</p></AppShell>)
    expect(html).toContain('href="/login"')
    expect(html).toContain('public content')
    expect(html).toContain('href="/search"')
    expect(html).not.toContain('>发布</button>')
    expect(html).not.toContain('notification-trigger')
  })

  it('keeps the authenticated publish label text-only', () => {
    state.session = { user: { id: 'member' } } as RiceSession
    const html = renderToStaticMarkup(<AppShell>{null}</AppShell>)
    expect(html).toContain('class="header-publish">发布</button>')
    expect(html).toContain('notification-trigger')
    expect(html).not.toContain('href="/login"')
  })

  it('does not render mutation controls even when a guest post contains viewer metadata', () => {
    const post = { author: { did: 'did:example:author' }, record: { text: '公开帖子', createdAt: '2026-09-16' }, viewer: { like: 'stale-like', repost: 'stale-repost' } } as PostView
    expect(renderToStaticMarkup(<PostActions post={post} onOpenComments={() => undefined} />)).toBe('')
  })
})
