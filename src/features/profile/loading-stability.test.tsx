import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { RiceSession, RiceUser } from '~/lib/models'

const state = vi.hoisted(() => ({ session: null as RiceSession | null, saveSession: vi.fn(), navigate: vi.fn(), logout: vi.fn(), logoutAction: undefined as (() => Promise<void>) | undefined }))
vi.mock('../session/session', () => ({ useStoredSession: () => ({ session: state.session, isReady: true, saveSession: state.saveSession }) }))
vi.mock('../session/api', async (original) => ({ ...await original<typeof import('../session/api')>(), logoutRice: state.logout }))
vi.mock('@astryxdesign/core/Button', () => ({ Button: ({ label, clickAction }: { label: string; clickAction?: () => Promise<void> }) => {
  if (label === '退出登录') state.logoutAction = clickAction
  return <button>{label}</button>
} }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => state.navigate,
  useRouter: () => ({ invalidate: vi.fn() }),
}))

import { ProfilePage, type ProfileInitialData } from './ProfilePage'
import { MyTasksPage } from '../tasks/MyTasksPage'
import { GrainHistoryPage } from '../grains/GrainHistoryPage'

const user = { id: 'member', did: 'did:example:member', handle: 'member.test', nickname: '当前用户', bio: '个人简介', avatar: null } as RiceUser
const initialData: ProfileInitialData = { accountId: user.id, sessionToken: 'token', user, wallet: { balance: 123, frozen: 7, earned: 140, entries: [] } }
beforeEach(() => {
  vi.clearAllMocks()
  state.logout.mockResolvedValue(true)
  state.logoutAction = undefined
  state.session = { token: 'token', user, pds: { did: user.did } } as RiceSession
})

it('clears the session without starting a late homepage navigation over the personal login form', async () => {
  renderToStaticMarkup(<ProfilePage initialData={initialData} />)
  await state.logoutAction!()
  expect(state.logout).toHaveBeenCalledWith({ data: 'token' })
  expect(state.saveSession).toHaveBeenCalledWith(null)
  expect(state.navigate).not.toHaveBeenCalled()
})

it('renders the prefetched profile and balance together on first render', () => {
  const html = renderToStaticMarkup(<ProfilePage initialData={initialData} />)
  expect(html).toContain('当前用户')
  expect(html).toContain('<strong>130</strong>')
  expect(html).toContain('<b>123</b>')
  expect(html).not.toContain('>—<')
  expect(html).not.toContain('节点稻米')
})

it('offers the community switch alongside the personal balance only for the current session', () => {
  const adminData = { ...initialData, communities: [{ id: 'community', name: '测试社区', wallet: { ...initialData.wallet, balance: 500 } }] }
  const html = renderToStaticMarkup(<ProfilePage initialData={adminData} />)
  expect(html).toContain('我的测试稻米')
  expect(html).toContain('节点稻米')
  expect(html).toContain('<strong>130</strong>')
  expect(html).not.toContain('<strong>507</strong>')
  expect(renderToStaticMarkup(<ProfilePage initialData={{ ...adminData, sessionToken: 'old-session' }} />)).not.toContain('节点稻米')
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

it('opens a prefetched community history immediately and rejects another wallet or session', () => {
  const snapshot = { ...initialData, nodeId: 'community' }
  const html = renderToStaticMarkup(<GrainHistoryPage embedded nodeId="community" initialData={snapshot} />)
  expect(html).toContain('节点稻米')
  expect(html).toContain('<strong>130</strong>')
  expect(html).not.toContain('正在加载明细')
  for (const stale of [{ ...snapshot, nodeId: 'other' }, { ...snapshot, sessionToken: 'old-session' }, initialData]) {
    const staleHtml = renderToStaticMarkup(<GrainHistoryPage embedded nodeId="community" initialData={stale} />)
    expect(staleHtml).not.toContain('<strong>130</strong>')
    expect(staleHtml).toContain('正在加载明细')
  }
})
