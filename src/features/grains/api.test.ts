import { expect, it } from 'vitest'
import { walletEntryIncoming, type WalletEntry } from './api'
it('distinguishes returned frozen funds from settlement direction for both parties', () => {
  const entry = { id: 'receipt', kind: 'reserved', amount: 20, subject_uri: null, inserted_at: '', from_user: { id: 'lin', nickname: '林', handle: 'lin.test' }, to_user: { id: 'host', nickname: '周', handle: 'host.test' } } satisfies WalletEntry
  expect(walletEntryIncoming(entry, 'lin')).toBe(false)
  expect(walletEntryIncoming({ ...entry, kind: 'refunded' }, 'lin')).toBe(true)
  expect(walletEntryIncoming({ ...entry, kind: 'event_fee' }, 'lin')).toBe(false)
  expect(walletEntryIncoming({ ...entry, kind: 'event_fee' }, 'host')).toBe(true)
})
