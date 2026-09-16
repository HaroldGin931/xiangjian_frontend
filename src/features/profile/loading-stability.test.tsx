import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { RiceSession, RiceUser } from '~/lib/models'

const state = vi.hoisted(() => ({ session: null as RiceSession | null }))
vi.mock('../session/session', () => ({ useStoredSession: () => ({ session: state.session, isReady: true, saveSession: vi.fn() }) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

import { ProfilePage, type ProfileInitialData } from './ProfilePage'
import { MyTasksPage } from '../tasks/MyTasksPage'
import { GrainHistoryPage } from '../grains/GrainHistoryPage'

const user = { id: 'member', did: 'did:example:member', handle: 'member.test', nickname: '当前用户', bio: '个人简介', avatar: null } as RiceUser
const initialData: ProfileInitialData = { accountId: user.id, sessionToken: 'token', user, wallet: { balance: 123, frozen: 7, earned: 140, entries: [] } }
beforeEach(() => { state.session = { token: 'token', user, pds: { did: user.did } } as RiceSession })

it('renders the prefetched profile and balance together on first render', () => {
  const html = renderToStaticMarkup(<ProfilePage initialData={initialData} />)
  expect(html).toContain('当前用户')
  expect(html).toContain('<strong>130</strong>')
  expect(html).toContain('<b>123</b>')
  expect(html).not.toContain('>—<')
})

it('does not display another account’s prefetched profile or balance', () => {
  const html = renderToStaticMarkup(<ProfilePage initialData={{ ...initialData, accountId: 'other', user: { ...user, nickname: '其他账号' } }} />)
  expect(html).toContain('当前用户')
  expect(html).not.toContain('其他账号')
  expect(html).not.toContain('<b>123</b>')
})

it('does not reuse a balance from an earlier login to the same account', () => {
  const html = renderToStaticMarkup(<ProfilePage initialData={{ ...initialData, sessionToken: 'old-session' }} />)
  expect(html).toContain('当前用户')
  expect(html).not.toContain('<b>123</b>')
})

it('does not guess task role tabs or zero counts before the personal history has loaded', () => {
  const html = renderToStaticMarkup(<MyTasksPage embedded />)
  expect(html).toContain('正在加载任务')
  expect(html).not.toContain('my-task-tabs')
  expect(html).not.toContain('这里还没有任务')
})

it('opens wallet history from the current account snapshot without an empty loading state', () => {
  const html = renderToStaticMarkup(<GrainHistoryPage embedded initialData={initialData} />)
  expect(html).toContain('<strong>130</strong>')
  expect(html).not.toContain('正在加载明细')
  expect(html).toContain('还没有资金记录')
  const otherAccount = renderToStaticMarkup(<GrainHistoryPage embedded initialData={{ ...initialData, accountId: 'other' }} />)
  expect(otherAccount).not.toContain('<strong>130</strong>')
  expect(otherAccount).toContain('正在加载明细')
})
