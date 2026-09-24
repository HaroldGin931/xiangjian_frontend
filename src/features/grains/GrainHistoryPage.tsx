import { LoginLink } from '../session/LoginLink'
import { TextInput } from '@astryxdesign/core/TextInput'
import { integerInputError } from '~/lib/integer-input'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { Sprout } from 'lucide-react'
import { usePanelReady } from '~/components/DetailDialog'
import { useEffect, useRef, useState } from 'react'
import { formatTimestamp } from '~/lib/format'
import { useStoredSession } from '../session/session'
import { fundCommunity, getWallet, walletEntryIncoming, type RiceWallet, type WalletEntry } from './api'

const labels: Record<WalletEntry['kind'], string> = { reserved: '冻结', refunded: '解冻', grant: '稻米发放', gift: '稻米转赠', reward: '内容赞赏', task_reward: '任务报酬', event_fee: '活动报名费', community_fund: '转入社区' }
export function GrainHistoryPage({ embedded = false, initialData, nodeId }: { embedded?: boolean; nodeId?: string; initialData?: { accountId: string; sessionToken: string; nodeId?: string; wallet: RiceWallet } | null }) {
  const { session } = useStoredSession()
  const current = initialData?.accountId === session?.user.id && initialData?.sessionToken === session?.token && initialData?.nodeId === nodeId ? initialData : null
  return <WalletHistory key={`${session?.token ?? 'guest'}:${nodeId ?? 'personal'}`} embedded={embedded} nodeId={nodeId} initialWallet={current?.wallet} />
}

function WalletHistory({ embedded, initialWallet, nodeId }: { embedded: boolean; initialWallet?: RiceWallet; nodeId?: string }) {
  const { session, isReady } = useStoredSession()
  const [wallet, setWallet] = useState<RiceWallet | null>(initialWallet ?? null)
  const [loading, setLoading] = useState(!initialWallet)
  const [error, setError] = useState('')
  const request = useRef(0)
  usePanelReady(isReady && (!session || Boolean(wallet || error)))
  useEffect(() => {
    if (!isReady) return
    if (!session) { setLoading(false); return }
    let active = true; ++request.current; setError('')
    if (initialWallet) { setWallet(initialWallet); setLoading(false); return () => { ++request.current } }
    setLoading(true)
    void getWallet({ data: { token: session.token, nodeId } }).then((value) => { if (active) setWallet(value) }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; ++request.current }
  }, [session?.token, isReady, initialWallet, nodeId])
  const more = async () => { if (!session || !wallet?.next_cursor || loading) return; const current = request.current; setLoading(true); setError(''); try { const page = await getWallet({ data: { token: session.token, nodeId, before: wallet.next_cursor } }); if (current === request.current) setWallet((previous) => ({ ...page, entries: [...(previous?.entries ?? []), ...page.entries] })) } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  if (isReady && !session) return <div className="page"><LoginLink className="primary-link">登录后查看稻米明细</LoginLink></div>
  return <div className="page grain-history-page">{!embedded && <Link to="/me" className="back-link">返回我的</Link>}<h1>{nodeId ? '节点稻米' : '我的稻米'}</h1><p className="muted">测试稻米</p>
    <section className="grain-history-summary"><div><Sprout size={24} /><span>稻米余额</span></div><strong>{wallet ? wallet.balance + wallet.frozen : '—'}</strong><dl><div><dt>可用</dt><dd>{wallet?.balance ?? '—'}</dd></div><div><dt>已冻结</dt><dd>{wallet?.frozen ?? '—'}</dd></div><div><dt>累计获得</dt><dd>{wallet?.earned ?? '—'}</dd></div></dl></section>
    {nodeId && session && wallet && <CommunityFunding nodeId={nodeId} token={session.token} onFunded={(value) => { ++request.current; setWallet(value); setLoading(false); setError('') }} />}
    <h2>稻米明细</h2>{error && <p className="inline-error" role="alert">{error}</p>}{loading && <p className={wallet ? 'refresh-status' : 'loading-line'} role="status">正在加载明细…</p>}
    <section className="grain-transfer-list">{wallet?.entries.map((entry) => { const incoming = walletEntryIncoming(entry, session?.user.id ?? '', nodeId); const party = incoming ? entry.from_user : entry.to_user; const node = incoming ? entry.from_node : entry.to_node; return <article className="grain-transfer-row" key={entry.id}><div><strong>{labels[entry.kind]}</strong>{(party || node) && <p>{node?.name || party?.nickname || party?.handle}</p>}<time>{formatTimestamp(entry.inserted_at, true)}</time><details className="receipt-reference"><summary>查看凭证</summary><p>凭证编号 {entry.id}</p></details></div><b className={incoming ? 'incoming' : 'outgoing'}>{incoming ? '+' : '−'}{entry.amount}</b></article> })}</section>
    {!loading && !error && !wallet?.entries.length && <p className="search-hint">还没有资金记录。</p>}{wallet?.next_cursor && <Button label="加载更多" variant="secondary" isDisabled={loading} clickAction={more} />}
  </div>
}

function CommunityFunding({ nodeId, token, onFunded }: { nodeId: string; token: string; onFunded: (wallet: RiceWallet) => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<{ amount: string; id: string } | null>(null)
  const amountError = amount ? integerInputError(amount, '转入金额', 1) : null
  const submit = async () => {
    if (busy || !amount || integerInputError(amount, '转入金额', 1)) return
    if (request.current?.amount !== amount) request.current = { amount, id: crypto.randomUUID() }
    setBusy(true); setError('')
    try {
      onFunded(await fundCommunity({ data: { token, nodeId, amount: Number(amount), clientRequestId: request.current.id } }))
      request.current = null; setAmount(''); setOpen(false); setConfirm(false)
      window.dispatchEvent(new Event('rice-changed'))
    } catch (e) { setError(e instanceof Error ? e.message : '转入失败，请重试。') } finally { setBusy(false) }
  }
  return <section className="business-section">
    {!open ? <Button label="从个人账户转入" variant="secondary" onClick={() => setOpen(true)} /> : <div className="form-stack">
      <TextInput label="转入金额" value={amount} onChange={value => { setAmount(value); setConfirm(false); setError('') }} isDisabled={busy} status={amountError ? { type: 'error', message: amountError } : undefined} width="100%" isRequired />
      <p>{confirm ? `确认将个人账户的 ${amount} 稻米转入本社区？` : '社区与个人账户分开记账，转入后由社区管理员用于社区任务。'}</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="form-actions"><Button label="返回" variant="secondary" isDisabled={busy} onClick={() => { setOpen(false); setConfirm(false) }} /><Button label={confirm ? '确认转入' : '转入社区'} variant="primary" isDisabled={busy || !amount || !!amountError} clickAction={confirm ? submit : () => setConfirm(true)} /></div>
    </div>}
  </section>
}
