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
