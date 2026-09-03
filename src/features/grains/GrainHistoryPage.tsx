import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Sprout } from 'lucide-react'
import { useEffect, useState } from 'react'

import { formatTimestamp } from '~/lib/format'
import type { RiceUser } from '~/lib/models'

import { getCurrentUser } from '../session/api'
import { useStoredSession } from '../session/session'
import { getGrainTransfers, type GrainTransfer } from './api'

const kindLabel: Record<GrainTransfer['kind'], string> = {
  grant: '后台发放',
  gift: '用户转赠',
  reward: '内容打赏',
  task_reward: '任务奖励',
}

export function GrainHistoryPage() {
  const { session, isReady } = useStoredSession()
  const [user, setUser] = useState<RiceUser | null>(null)
  const [transfers, setTransfers] = useState<GrainTransfer[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isReady || !session) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')
    void Promise.all([
      getCurrentUser({ data: session.token }),
      getGrainTransfers({ data: { token: session.token, limit: 20 } }),
    ])
      .then(([currentUser, page]) => {
        if (!active) return
        setUser(currentUser)
        setTransfers(page.data)
        setNextCursor(page.meta.next_cursor)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '稻米流水暂时无法加载')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isReady, session])

  if (isReady && !session) {
    return (
      <div className="page signed-out-state">
        <strong>登录后查看稻米流水</strong>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  const loadMore = async () => {
    if (!session || !nextCursor || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const page = await getGrainTransfers({
        data: { token: session.token, before: nextCursor, limit: 20 },
      })
      setTransfers((current) => [...current, ...page.data])
      setNextCursor(page.meta.next_cursor)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更多流水暂时无法加载')
    } finally {
      setLoadingMore(false)
    }
  }

  const profile = user ?? session?.user

  return (
    <div className="page grain-history-page">
      <Link to="/me" className="back-link"><ArrowLeft size={16} /> 我的</Link>
      <header className="grain-history-summary">
        <div><Sprout size={22} aria-hidden="true" /><span>我的稻米</span></div>
        <strong>{profile?.grain_balance ?? '—'}</strong>
        <dl>
          <div><dt>可用</dt><dd>{profile?.grain_balance ?? '—'}</dd></div>
          <div><dt>任务冻结</dt><dd>{profile?.grain_frozen_balance ?? 0}</dd></div>
        </dl>
      </header>

      <h1>稻米流水</h1>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {loading ? <div className="loading-line">正在加载流水…</div> : null}
      {!loading && !transfers.length && !error ? (
        <section className="task-empty-state"><strong>还没有稻米流水</strong></section>
      ) : null}
      {transfers.length ? (
        <section className="grain-transfer-list">
          {transfers.map((transfer) => {
            const incoming = transfer.direction === 'in'
            const counterparty = incoming ? transfer.from : transfer.to
            return (
              <article className="grain-transfer-row" key={transfer.id}>
                <span className={`grain-transfer-icon ${incoming ? 'incoming' : 'outgoing'}`}>
                  {incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                </span>
                <div>
                  <strong>{kindLabel[transfer.kind]}</strong>
                  <p>{transfer.memo || counterparty?.nickname || counterparty?.handle || '系统发放'}</p>
                  <time>{formatTimestamp(transfer.inserted_at, true)}</time>
                </div>
                <b className={incoming ? 'incoming' : 'outgoing'}>
                  {incoming ? '+' : '-'}{transfer.amount}
                </b>
              </article>
            )
          })}
        </section>
      ) : null}
      {nextCursor ? (
        <div className="task-load-more">
          <Button
            label={loadingMore ? '正在加载…' : '加载更多'}
            variant="secondary"
            isDisabled={loadingMore}
            clickAction={loadMore}
          />
        </div>
      ) : null}
    </div>
  )
}
