import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DetailDialog, usePanelReady } from '~/components/DetailDialog'
import { publicAttachmentUrl } from '~/lib/attachments'
import { formatTimestamp } from '~/lib/format'
import { useStoredSession } from '../session/session'
import { TasksPage } from '../tasks/TasksPage'
import { EventsPage } from '../events/EventsPage'
import { applyToNode, getNode, getNodes, reviewNodeApplication, type CommunityNode, type NodeMine } from './api'

export function NodeCard({ node, onOpen }: { node: CommunityNode; onOpen: () => void }) {
  return <button type="button" className="profile-menu-row node-card" onClick={onOpen}>
    <span className="content-card-avatar" aria-hidden="true">{node.logo ? <img src={publicAttachmentUrl(node.logo.url)} alt="" /> : node.name.slice(0, 1)}</span>
    <span><strong>{node.name}</strong><small>{node.role === 'admin' ? '管理员' : node.role === 'member' ? '正式成员' : node.my_application?.status === 'pending' ? '申请中' : node.description}</small></span><ArrowRight size={18} />
  </button>
}

export function NodesPanel({ identity = false }: { identity?: boolean }) {
  const { session, isReady } = useStoredSession()
  const owner = session?.user.id ?? 'guest'
  const [data, setData] = useState<{ owner: string; nodes: CommunityNode[] } | null>(null)
  const [filter, setFilter] = useState<NodeMine | undefined>(identity ? 'identity' : undefined)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ owner: string; id: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => { const refresh = () => setVersion((v) => v + 1); window.addEventListener('rice-changed', refresh); return () => window.removeEventListener('rice-changed', refresh) }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 250)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => {
    if (!isReady) return
    let active = true
    setLoading(true); setError('')
    void getNodes({ data: { token: session?.token, mine: filter, q: search } }).then((nodes) => { if (active) setData({ owner, nodes }) })
      .catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isReady, owner, session?.token, filter, search, version])
  const nodes = data?.owner === owner ? data.nodes : null
  usePanelReady(isReady && (nodes !== null || !!error))
  return <div className="page business-panel list-panel" aria-busy={loading || query !== search}><h1>{identity ? '社区身份' : '节点目录'}</h1>
    {!identity && <><input className="business-search" aria-label="搜索社区" placeholder="搜索社区" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="filter-buttons">{([[undefined, '全部节点'], ['joined', '已加入'], ['pending', '申请中']] as const).map(([value, label]) => <Button key={label} label={label} variant="ghost" className={filter === value ? 'active' : undefined} aria-pressed={filter === value} onClick={() => setFilter(value)} />)}</div></>}
    {error && <p className="inline-error" role="alert">{error}</p>}{nodes && (loading || query !== search) && <p className="refresh-status" role="status">正在更新社区…</p>}{!nodes && !error && <p className="loading-line">正在加载社区…</p>}
    <div className="node-list">{nodes?.map((node) => <NodeCard node={node} onOpen={() => setSelected({ owner, id: node.id })} key={node.id} />)}</div>
    {nodes && !error && !nodes.length && <p className="search-hint">{identity ? '还没有社区身份或待处理的申请。' : '没有找到社区。'}</p>}
    {selected?.owner === owner && <DetailDialog title="社区详情" onClose={() => setSelected(null)}><NodeDetail nodeId={selected.id} /></DetailDialog>}
  </div>
}

export function NodeDetail({ nodeId }: { nodeId: string }) {
  const { session } = useStoredSession()
  const [node, setNode] = useState<CommunityNode | null>(null)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stream, setStream] = useState<'tasks' | 'events' | null>(null)
  usePanelReady(node !== null || !!error)
  useEffect(() => {
    let active = true
    setNode(null); setError('')
    void getNode({ data: { id: nodeId, token: session?.token } }).then((value) => { if (active) setNode(value) }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [nodeId, session?.token])
  const run = async (action: () => Promise<CommunityNode>) => { setBusy(true); setError(''); try { setNode(await action()); setApplyOpen(false); window.dispatchEvent(new Event('rice-changed')) } catch (e) { setError(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) } }
  return <div className="page business-panel">{error && <p className="inline-error" role="alert">{error}</p>}{!node && !error && <p>正在加载社区…</p>}{node && <>
    <h1>{node.name}</h1><p className="business-description">{node.description}</p>
    <section className="business-section"><h2>社区成员</h2>{node.members?.map(({ user, role }) => <p key={user.id}><Link to="/profile/$actor" params={{ actor: user.did }}>{user.nickname || user.handle}</Link> · {role === 'admin' ? '管理员' : '成员'}</p>)}</section>
    {node.role ? <p className="task-neutral-note">我的身份：{node.role === 'admin' ? '管理员' : '正式成员'}</p> : node.my_application?.status === 'pending' ? <p className="task-neutral-note">加入申请已提交，等待管理员审批。</p> : node.owner && session ? <section className="business-section">
      {node.my_application?.status === 'rejected' && <p>上次加入申请未通过，可重新申请。{node.my_application.review_reason}</p>}
      {applyOpen ? <><TextArea label="加入说明" value={reason} onChange={setReason} rows={3} maxLength={512} width="100%" /><Button label="提交申请" variant="primary" isDisabled={busy} clickAction={() => run(() => applyToNode({ data: { token: session.token, nodeId, reason } }))} /></> : <Button label="申请加入社区" variant="primary" onClick={() => setApplyOpen(true)} />}
    </section> : null}
    {node.role === 'admin' && session && <section className="business-section"><h2>待审批申请</h2>{node.applications?.filter((a) => a.status === 'pending').map((a) => <article className="candidate" key={a.id}><strong>{a.user?.nickname || a.user?.handle}</strong><p>{a.reason}</p><div className="button-row"><Button label="拒绝" variant="secondary" isDisabled={busy} clickAction={() => run(() => reviewNodeApplication({ data: { token: session.token, nodeId, applicationId: a.id, action: 'reject' } }))} /><Button label="通过" variant="primary" isDisabled={busy} clickAction={() => run(() => reviewNodeApplication({ data: { token: session.token, nodeId, applicationId: a.id, action: 'approve' } }))} /></div></article>)}{!node.applications?.some((a) => a.status === 'pending') && <p>暂无待审批申请。</p>}</section>}
    {node.role === 'admin' && node.applications?.some((a) => a.status !== 'pending') && <details className="business-section"><summary>已处理申请</summary><ul className="business-history">{node.applications.filter((a) => a.status !== 'pending').map((a) => <li key={a.id}><strong>{a.user?.nickname || a.user?.handle} · {a.status === 'approved' ? '已通过' : '未通过'}</strong><p>{a.reason}</p>{a.review_reason && <p>{a.review_reason}</p>}<time>{formatTimestamp(a.reviewed_at || a.inserted_at, true)}</time></li>)}</ul></details>}
    <section className="business-section"><h2>社区动态</h2><div className="button-row"><Button label="社区任务" variant="secondary" onClick={() => setStream('tasks')} /><Button label="社区活动" variant="secondary" onClick={() => setStream('events')} /></div></section>
    {stream && <DetailDialog title={stream === 'tasks' ? '社区任务' : '社区活动'} onClose={() => setStream(null)}>{stream === 'tasks' ? <TasksPage nodeId={nodeId} embedded /> : <EventsPage nodeId={nodeId} embedded />}</DetailDialog>}
  </>}</div>
}
