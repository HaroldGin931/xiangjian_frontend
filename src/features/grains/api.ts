import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { RicePublicUser } from '~/lib/models'

export type GrainTransfer = {
  id: string
  kind: 'grant' | 'gift' | 'reward' | 'task_reward'
  amount: number
  memo: string
  subject_uri: string | null
  from: RicePublicUser | null
  to: RicePublicUser
  direction: 'in' | 'out'
  inserted_at: string
}

export type GrainTransferPage = {
  data: GrainTransfer[]
  meta: { next_cursor: string | null }
}

export const getGrainTransfers = createServerFn({ method: 'POST' })
  .validator((data: { token: string; before?: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams()
    if (data.before) query.set('before', data.before)
    if (data.limit) query.set('limit', String(data.limit))
    const suffix = query.size ? `?${query}` : ''

    return requestJson<GrainTransferPage>(`${BACKEND_BASE}/api/grain_transfers${suffix}`, {
      headers: { Authorization: `Bearer ${data.token}` },
    })
  })

export type WalletEntry = { id: string; kind: 'reserved' | 'refunded' | 'grant' | 'gift' | 'reward' | 'task_reward' | 'event_fee'; amount: number; subject_uri: string | null; inserted_at: string; from_user: Pick<RicePublicUser, 'id' | 'nickname' | 'handle'> | null; to_user: Pick<RicePublicUser, 'id' | 'nickname' | 'handle'> | null }
export type RiceWallet = { balance: number; frozen: number; earned: number; entries: WalletEntry[]; next_cursor?: string | null }
export const getWallet = createServerFn({ method: 'POST' })
  .validator((data: { token: string; before?: string }) => data)
  .handler(async ({ data }) => (await requestJson<{ data: RiceWallet }>(`${BACKEND_BASE}/api/wallet${data.before ? `?before=${encodeURIComponent(data.before)}` : ''}`, { headers: { Authorization: `Bearer ${data.token}` } })).data)
export function walletEntryIncoming(entry: WalletEntry, userId: string) { return entry.kind === 'refunded' || (entry.kind !== 'reserved' && entry.to_user?.id === userId) }
