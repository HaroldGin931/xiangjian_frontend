import { Button } from '@astryxdesign/core/Button'
import { useRouter } from '@tanstack/react-router'
import { ArrowRight, LogOut, Pencil } from 'lucide-react'
import { useState } from 'react'
import { DetailDialog } from '~/components/DetailDialog'
import { Avatar } from '~/components/Avatar'
import type { RiceUser } from '~/lib/models'
import { logoutRice } from '../session/api'
import { useStoredSession } from '../session/session'
import { NodesPanel } from '../nodes/NodesPanel'
import { MyTasksPage } from '../tasks/MyTasksPage'
import { EventsPage } from '../events/EventsPage'
import { GrainHistoryPage } from '../grains/GrainHistoryPage'
import type { RiceWallet } from '../grains/api'
import { UserProfilePage } from '../social/UserProfilePage'
import { ProfileEditPage } from '../account/ProfileEditPage'
import { MyPostsPage } from './MyPostsPage'

type Panel = 'identity' | 'tasks' | 'events' | 'posts' | 'alliance' | 'nodes' | 'wallet' | 'profile' | 'edit'
const titles: Record<Panel, string> = { identity: '社区身份', tasks: '我的任务', events: '我的活动', posts: '我的帖子', alliance: '联盟与治理', nodes: '节点目录', wallet: '稻米明细', profile: '我的主页', edit: '编辑资料' }
export type ProfileInitialData = {
  accountId: string; sessionToken: string; user: RiceUser; wallet: RiceWallet
  communities?: Array<{ id: string; name: string; wallet: RiceWallet | null; error?: string }>
  communityError?: string
}

export function ProfilePage({ initialData = null, initialError = '' }: { initialData?: ProfileInitialData | null; initialError?: string }) {
  const { session, isReady, saveSession } = useStoredSession()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [communitySelection, setCommunitySelection] = useState<{ accountId: string; sessionToken: string; nodeId: string } | null>(null)
  const router = useRouter()
  const logout = async () => { if (session) await logoutRice({ data: session.token }).catch(() => undefined); saveSession(null) }
  if (!isReady || !session) return null
  const current = initialData?.accountId === session.user.id && initialData.sessionToken === session.token ? initialData : null
  const profile = current?.user ?? session.user
  const communities = current?.communities ?? []
  const community = communitySelection?.accountId === session.user.id && communitySelection.sessionToken === session.token ? communities.find(({ id }) => id === communitySelection.nodeId) : undefined
  const wallet = community ? community.wallet : current?.wallet
  const walletSnapshot = current && wallet ? { accountId: current.accountId, sessionToken: current.sessionToken, nodeId: community?.id, wallet } : null
  const selectCommunity = (nodeId: string) => setCommunitySelection({ accountId: session.user.id, sessionToken: session.token, nodeId })
  return <div className="page profile-page">
    <section className="profile-identity"><button type="button" className="profile-identity-edit" aria-label="编辑资料" onClick={() => setPanel('edit')}><Pencil size={20} /></button>
      <Avatar name={profile.nickname || profile.handle} src={profile.avatar?.url} size="large" /><h1>{profile?.nickname || profile?.handle || '正在加载'}</h1><p>@{profile?.handle || '—'}</p>{profile?.bio && <p>{profile.bio}</p>}<div className="profile-public-action"><Button label="查看主页" variant="secondary" onClick={() => setPanel('profile')} /></div>
    </section>
    {initialError && <p className="inline-error" role="alert">{initialError}{current && ' 目前显示上次加载的数据。'}</p>}
    <section className="grain-card">
      <header>
        {communities.length ? (
          <div className="filter-buttons grain-wallet-tabs" role="group" aria-label="稻米账户">
            <Button label="我的测试稻米" variant="ghost" className={!community ? 'active' : undefined} aria-pressed={!community} onClick={() => setCommunitySelection(null)} />
            <Button label="节点稻米" variant="ghost" className={community ? 'active' : undefined} aria-pressed={!!community} onClick={() => selectCommunity(community?.id ?? communities[0].id)} />
          </div>
        ) : <span>我的测试稻米</span>}
        <Button label="查看流水" variant="ghost" isDisabled={!wallet} onClick={() => setPanel('wallet')}>查看流水 →</Button>
      </header>
      {community && (communities.length > 1 ? (
        <label className="native-field">管理的社区
          <select value={community.id} onChange={(event) => selectCommunity(event.target.value)}>
            {communities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      ) : <p className="muted">{community.name}</p>)}
      {(community?.error || current?.communityError) && (
        <p className="inline-error" role="alert">{community?.error || current?.communityError}</p>
      )}
      <strong>{wallet ? wallet.balance + wallet.frozen : '—'}</strong>
      <div className="grain-metrics">
        <div><b>{wallet?.balance ?? '—'}</b><span>可用</span></div>
        <div><b>{wallet?.frozen ?? '—'}</b><span>冻结</span></div>
        <div><b>{wallet?.earned ?? '—'}</b><span>累计获得</span></div>
      </div>
    </section>
    <nav className="profile-menu" aria-label="个人中心功能">{([['identity', '我在各社区的身份'], ['tasks', '申请中 · 进行中 · 审核中 · 已结束'], ['events', '我申请 / 主办的活动']] as const).map(([value, copy]) => <button type="button" className="profile-menu-row" key={value} onClick={() => setPanel(value)}><span className="profile-menu-copy"><strong>{titles[value]}</strong><small>{copy}</small></span><ArrowRight size={18} /></button>)}
      <button type="button" className="profile-menu-row" onClick={() => setPanel('posts')}><span className="profile-menu-copy"><strong>我的帖子</strong><small>在广场发布过的内容</small></span><ArrowRight size={18} /></button>
      <button type="button" className="profile-menu-row" onClick={() => setPanel('alliance')}><span className="profile-menu-copy"><strong>联盟与治理</strong><small>浏览联盟中的社区节点</small></span><ArrowRight size={18} /></button>
    </nav><div className="logout-button"><Button label="退出登录" icon={<LogOut size={16} />} variant="ghost" clickAction={logout} /></div>
    {panel && <DetailDialog title={titles[panel]} onClose={() => { setPanel(null); setDirectoryOpen(false) }}>
      {panel === 'identity' ? <NodesPanel identity /> : panel === 'nodes' ? <NodesPanel /> : panel === 'tasks' ? <MyTasksPage embedded /> : panel === 'events' ? <EventsPage mine embedded /> : panel === 'posts' ? <MyPostsPage embedded /> : panel === 'wallet' ? (
        walletSnapshot
          ? <GrainHistoryPage embedded nodeId={community?.id} initialData={walletSnapshot} />
          : <p className="inline-error" role="alert">{community?.error || '稻米明细暂时无法加载，请稍后重试。'}</p>
      ) : panel === 'profile' ? <UserProfilePage actor={profile?.did ?? session?.pds.did ?? ''} onEdit={() => setPanel('edit')} /> : panel === 'edit' ? <ProfileEditPage onSaved={() => { setPanel(null); void router.invalidate({ filter: (match) => match.routeId === '/me/' }) }} /> : <div className="page business-panel list-panel"><h1>联盟与治理</h1><button type="button" className="profile-menu-row node-card" onClick={() => setDirectoryOpen(true)}><span className="profile-menu-copy"><strong>节点目录</strong><small>查看联盟中的社区</small></span><ArrowRight size={18} /></button></div>}
      {directoryOpen && <DetailDialog title="节点目录" onClose={() => setDirectoryOpen(false)}><NodesPanel /></DetailDialog>}
    </DetailDialog>}
  </div>
}
