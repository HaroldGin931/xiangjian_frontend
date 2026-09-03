import { Button } from '@astryxdesign/core/Button'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, LogOut, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { publicAttachmentUrl } from '~/lib/attachments'
import type { RiceUser } from '~/lib/models'

import { getCurrentUser, logoutRice } from '../session/api'
import { useStoredSession } from '../session/session'

const disabledRows = [
  ['我的社区', '社区接口尚未接入'],
  ['联盟与治理', '社区指南、联盟公告和只读提案'],
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
          {profile?.avatar ? (
            <img src={publicAttachmentUrl(profile.avatar.url)} alt="" />
          ) : <UserRound size={28} />}
        </div>
        <h1>{profile?.nickname || profile?.handle?.split('.')[0] || '正在加载'}</h1>
        <p>Rice + AT Protocol · @{profile?.handle || '—'}</p>
        <span>{profile?.node_member ? '节点成员' : '社区成员'}</span>
        <div className="profile-actions">
          <Link to="/me/settings/profile">编辑资料</Link>
          <Button label="查看主页" variant="secondary" isDisabled tooltip="主页接口尚未接入" width="100%" />
        </div>
      </section>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}

      <section className="grain-card">
        <header>
          <span>我的稻米</span>
          <Button label="查看流水" variant="ghost" size="sm" isDisabled tooltip="稻米结算接口尚未确认">查看流水 →</Button>
        </header>
        <strong>{profile?.grain_balance ?? '—'}</strong>
        <div className="grain-metrics">
          <div><b>{profile?.grain_balance ?? '—'}</b><span>可用</span></div>
          <div className="unavailable"><b>—</b><span>冻结</span></div>
          <div className="unavailable"><b>—</b><span>累计获得</span></div>
        </div>
      </section>

      <nav className="profile-menu" aria-label="个人中心功能">
        <Link to="/me/tasks" className="profile-menu-row">
          <span><strong>我的任务</strong><small>承作 / 发布 / 申请</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/me/posts" className="profile-menu-row">
          <span><strong>我的帖子</strong><small>在广场发布的真实内容</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        {disabledRows.map(([title, description]) => (
          <div
            className="profile-menu-row disabled"
            aria-disabled="true"
            key={title}
          >
            <span><strong>{title}</strong><small>{description}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </div>
        ))}
        <Link to="/me/settings" className="profile-menu-row">
          <span><strong>设置</strong><small>账号、资料、通知与隐私</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </nav>

      <div className="logout-button">
        <Button label="退出登录" icon={<LogOut size={16} aria-hidden="true" />} variant="ghost" clickAction={handleLogout} />
      </div>
    </div>
  )
}
