import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, LogOut, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { RiceUser } from '~/lib/models'

import { getCurrentUser, logoutRice } from '../session/api'
import { useStoredSession } from '../session/session'

const disabledRows = [
  ['我的社区', '社区接口尚未接入'],
  ['联盟与治理', '社区指南、联盟公告和只读提案'],
  ['设置', '账号、通知与隐私'],
] as const

export function ProfilePage() {
  const { session, isReady, saveSession } = useStoredSession()
  const [user, setUser] = useState<RiceUser | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) {
      setUser(null)
      return
    }
    setError('')
    void getCurrentUser({ data: session.token })
      .then(setUser)
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : '账号信息暂时无法加载')
      })
  }, [session])

  const handleLogout = async () => {
    if (session) await logoutRice({ data: session.token }).catch(() => undefined)
    saveSession(null)
    await navigate({ to: '/login' })
  }

  if (isReady && !session) {
    return (
      <div className="page profile-page signed-out-state">
        <UserRound size={34} aria-hidden="true" />
        <strong>还没有登录</strong>
        <p>登录后查看身份、稻米和个人内容。</p>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  const profile = user ?? session?.user
  return (
    <div className="page profile-page">
      <section className="profile-identity">
        <div className="profile-avatar" aria-hidden="true">
          <UserRound size={28} />
        </div>
        <h1>{profile?.nickname || profile?.handle?.split('.')[0] || '正在加载'}</h1>
        <p>Rice + AT Protocol · @{profile?.handle || '—'}</p>
        <span>{profile?.node_member ? '节点成员' : '社区成员'}</span>
        <div className="profile-actions">
          <button type="button" disabled aria-label="编辑资料，接口尚未接入">编辑资料</button>
          <button type="button" disabled aria-label="查看主页，接口尚未接入">查看主页</button>
        </div>
      </section>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}

      <section className="grain-card">
        <header><span>我的稻米</span><button type="button" disabled>查看流水 →</button></header>
        <strong>{profile?.grain_balance ?? '—'}</strong>
        <div className="grain-metrics">
          <div><b>{profile?.grain_balance ?? '—'}</b><span>可用</span></div>
          <div className="unavailable"><b>—</b><span>冻结</span></div>
          <div className="unavailable"><b>—</b><span>累计获得</span></div>
        </div>
      </section>

      <nav className="profile-menu" aria-label="个人中心功能">
        <button
          type="button"
          className="profile-menu-row disabled"
          disabled
          aria-label="我的任务，接口尚未接入"
        >
          <span><strong>我的任务</strong><small>承作 / 发布 / 申请 / 协作 / 监督</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <Link to="/me/posts" className="profile-menu-row">
          <span><strong>我的帖子</strong><small>在广场发布的真实内容</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        {disabledRows.map(([title, description]) => (
          <button
            type="button"
            className="profile-menu-row disabled"
            disabled
            aria-label={`${title}，接口尚未接入`}
            key={title}
          >
            <span><strong>{title}</strong><small>{description}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <button type="button" className="logout-button" onClick={handleLogout}>
        <LogOut size={16} aria-hidden="true" /> 退出登录
      </button>
    </div>
  )
}
