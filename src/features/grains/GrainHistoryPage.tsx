import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { Sprout } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatTimestamp } from '~/lib/format'
import { useStoredSession } from '../session/session'
import { getWallet, walletEntryIncoming, type RiceWallet, type WalletEntry } from './api'

const labels: Record<WalletEntry['kind'], string> = { reserved: '冻结', refunded: '解冻', grant: '稻米发放', gift: '稻米转赠', reward: '内容打赏', task_reward: '任务报酬', event_fee: '活动报名费' }
export function GrainHistoryPage({ embedded = false }: { embedded?: boolean }) {
  const { session } = useStoredSession()
  return <WalletHistory key={session?.token ?? 'guest'} embedded={embedded} />
}

function WalletHistory({ embedded }: { embedded: boolean }) {
  const { session, isReady } = useStoredSession()
  const [wallet, setWallet] = useState<RiceWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef(0)
  useEffect(() => {
    if (!isReady) return
    if (!session) { setLoading(false); return }
    let active = true; ++request.current
    setLoading(true); setError(''); setWallet(null)
    void getWallet({ data: { token: session.token } }).then((value) => { if (active) setWallet(value) }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; ++request.current }
  }, [session?.token, isReady])
  const more = async () => { if (!session || !wallet?.next_cursor || loading) return; const current = request.current; setLoading(true); setError(''); try { const page = await getWallet({ data: { token: session.token, before: wallet.next_cursor } }); if (current === request.current) setWallet((previous) => ({ ...page, entries: [...(previous?.entries ?? []), ...page.entries] })) } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  if (isReady && !session) return <div className="page"><Link to="/login" className="primary-link">登录后查看稻米明细</Link></div>
  return <div className="page grain-history-page">{!embedded && <Link to="/me" className="back-link">返回我的</Link>}<h1>我的稻米</h1><p className="muted">测试稻米</p>
    <section className="grain-history-summary"><div><Sprout size={24} /><span>稻米余额</span></div><strong>{wallet ? wallet.balance + wallet.frozen : '—'}</strong><dl><div><dt>可用</dt><dd>{wallet?.balance ?? '—'}</dd></div><div><dt>已冻结</dt><dd>{wallet?.frozen ?? '—'}</dd></div><div><dt>累计获得</dt><dd>{wallet?.earned ?? '—'}</dd></div></dl></section>
    <h2>稻米明细</h2>{error && <p className="inline-error" role="alert">{error}</p>}{loading && <p className="loading-line">正在加载明细…</p>}
    <section className="grain-transfer-list">{wallet?.entries.map((entry) => { const incoming = walletEntryIncoming(entry, session?.user.id ?? ''); const party = incoming ? entry.from_user : entry.to_user; return <article className="grain-transfer-row" key={entry.id}><div><strong>{labels[entry.kind]}</strong>{party && <p>{party.nickname || party.handle}</p>}<time>{formatTimestamp(entry.inserted_at, true)}</time><details className="receipt-reference"><summary>查看凭证</summary><p>凭证编号 {entry.id}</p></details></div><b className={incoming ? 'incoming' : 'outgoing'}>{incoming ? '+' : '−'}{entry.amount}</b></article> })}</section>
    {!loading && !error && !wallet?.entries.length && <p className="search-hint">还没有资金记录。</p>}{wallet?.next_cursor && <Button label="加载更多" variant="secondary" isDisabled={loading} clickAction={more} />}
  </div>
}
