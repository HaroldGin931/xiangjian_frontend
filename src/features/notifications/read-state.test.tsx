import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { NotificationView } from '~/lib/models'

const mock = vi.hoisted(() => ({
  social: vi.fn(), business: vi.fn(), readSocial: vi.fn(), readBusiness: vi.fn(),
  values: [] as unknown[], index: 0,
  effects: [] as Array<{ deps: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
}))
vi.mock('./api', async (original) => ({
  ...await original<typeof import('./api')>(),
  getNotifications: mock.social, getTaskNotifications: mock.business,
  markNotificationsRead: mock.readSocial, markTaskNotificationsRead: mock.readBusiness,
}))
vi.mock('../session/session', () => ({ useStoredSession: () => ({
  isReady: true, session: { token: 'rice-token', pds: { access_jwt: 'pds-token', did: 'did:plc:reader' } },
}) }))
vi.mock('~/components/DetailDialog', () => ({ DetailDialog: () => null, usePanelReady: () => undefined }))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const i = mock.index++
    if (!(i in mock.values)) mock.values[i] = initial
    return [mock.values[i], (value: unknown) => {
      mock.values[i] = typeof value === 'function' ? value(mock.values[i]) : value
    }]
  },
  useRef: (initial: unknown) => {
    const i = mock.index++
    return mock.values[i] ?? (mock.values[i] = { current: initial })
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const i = mock.index++
    if (mock.effects[i]?.deps.every((dep, j) => Object.is(dep, deps[j]))) return
    mock.pending.push(() => {
      mock.effects[i]?.cleanup?.()
      mock.effects[i] = { deps, cleanup: effect() || undefined }
    })
  },
}))

import { NotificationsPage } from './NotificationsPage'

function elements(node: ReactNode): Array<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

function render() {
  mock.index = 0
  const inbox = NotificationsPage({ embedded: true })
  const view = (inbox.type as (props: typeof inbox.props) => ReactNode)(inbox.props)
  mock.pending.splice(0).forEach((effect) => effect())
  return elements(view)
}

afterEach(() => {
  mock.effects.forEach((effect) => effect?.cleanup?.())
  mock.effects = []; mock.values = []; mock.pending = []
  vi.unstubAllGlobals(); vi.clearAllMocks()
})

it('keeps failed post reads unread while Rice succeeds, then retries the write and clears its error', async () => {
  vi.stubGlobal('window', new EventTarget())
  const notification = { author: { handle: 'actor.test' }, indexedAt: '2026-09-22T00:00:00Z', text: '', isRead: false }
  const social: NotificationView = { ...notification, uri: 'at://did:plc:actor/app.bsky.feed.post/reply', reason: 'reply' }
  const business: NotificationView[] = ['task', 'event'].map((subjectType) => ({
    ...notification, uri: `business:${subjectType}`, reason: `${subjectType}-application_created`, subjectType, subjectId: subjectType,
  }))
  mock.social.mockResolvedValue([social]); mock.business.mockResolvedValue(business)
  mock.readBusiness.mockResolvedValue(undefined)
  let fail!: (error: Error) => void
  mock.readSocial.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject }))
  const unread = () => render().filter((element) => element.props.className === 'notification-row unread')
  const action = (label: string, prop: 'clickAction' | 'onClick') =>
    render().find((element) => element.props.label === label)!.props[prop] as () => Promise<void>

  await vi.waitFor(() => expect(unread()).toHaveLength(3))
  const marking = action('全部已读', 'clickAction')()
  expect(unread()).toHaveLength(3)
  fail(new Error('写入失败')); await marking
  expect(unread()).toHaveLength(1)
  expect(render().find((element) => element.props.role === 'alert')).toBeDefined()
  expect(mock.readSocial).toHaveBeenCalledWith({ data: 'pds-token' })
  expect(mock.readBusiness).toHaveBeenCalledWith({ data: 'rice-token' })

  mock.readSocial.mockResolvedValueOnce(undefined)
  await action('重试', 'onClick')()
  expect(mock.readSocial).toHaveBeenCalledTimes(2)
  expect(unread()).toHaveLength(0)
  expect(render().find((element) => element.props.role === 'alert')).toBeUndefined()
  expect(mock.social).toHaveBeenCalledTimes(1)
})
