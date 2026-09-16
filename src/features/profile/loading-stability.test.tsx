import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { RiceSession, RiceUser } from '~/lib/models'

const state = vi.hoisted(() => ({ session: null as RiceSession | null }))
vi.mock('../session/session', () => ({ useStoredSession: () => ({ session: state.session, isReady: true, saveSession: vi.fn() }) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

import { ProfilePage, type ProfileInitialData } from './ProfilePage'
import { MyTasksPage } from '../tasks/MyTasksPage'

const user = { id: 'member', did: 'did:example:member', handle: 'member.test', nickname: '当前用户', bio: '个人简介', avatar: null } as RiceUser
const initialData: ProfileInitialData = { accountId: user.id, user, wallet: { balance: 123, frozen: 7, earned: 140, entries: [] } }
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

it('does not guess task role tabs or zero counts before the personal history has loaded', () => {
  const html = renderToStaticMarkup(<MyTasksPage embedded />)
  expect(html).toContain('正在加载任务')
  expect(html).not.toContain('my-task-tabs')
  expect(html).not.toContain('这里还没有任务')
})
