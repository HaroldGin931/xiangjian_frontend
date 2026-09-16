import { afterEach, expect, it, vi } from 'vitest'
import { createDetailPrefetch } from './useDetailPrefetch'

afterEach(() => vi.useRealTimers())

it('reuses hover, click and reopen requests, and refreshes after expiry or a business change', async () => {
  vi.useFakeTimers()
  let resolve!: (value: string) => void
  const fetch = vi.fn(() => new Promise<string>((done) => { resolve = done }))
  const card = createDetailPrefetch(fetch)
  const hovered = card.load()
  expect(card.load()).toBe(hovered)
  resolve('detail')
  await hovered
  expect(await card.load()).toBe('detail')
  expect(fetch).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(30_001)
  const expired = card.load()
  expect(expired).not.toBe(hovered)
  card.clear()
  const changed = card.load()
  expect(changed).not.toBe(expired)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('does not reuse failed prefetches or share a response with a new account/card', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('account A')
  const a = createDetailPrefetch(fetch)
  await expect(a.load()).rejects.toThrow('offline')
  expect(await a.load()).toBe('account A')
  const b = createDetailPrefetch(async () => 'account B')
  expect(await b.load()).toBe('account B')
  expect(await a.load()).toBe('account A')
  expect(fetch).toHaveBeenCalledTimes(2)
})
