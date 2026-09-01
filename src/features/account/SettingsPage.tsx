import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, LogOut } from 'lucide-react'

import { logoutRice } from '../session/api'
import { useStoredSession } from '../session/session'

export function SettingsPage() {
  const { session, saveSession } = useStoredSession()
  const navigate = useNavigate()

  if (!session) {
    return (
      <div className="page signed-out-state">
        <strong>登录后管理账号</strong>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  const logout = async () => {
    await logoutRice({ data: session.token }).catch(() => undefined)
    saveSession(null)
    await navigate({ to: '/login' })
  }

  return (
    <div className="page settings-page">
      <Link to="/me" className="back-link"><ArrowLeft size={16} /> 我的</Link>
      <h1>设置</h1>
      <nav className="profile-menu" aria-label="设置项目">
        <Link to="/me/settings/account" className="profile-menu-row">
          <span><strong>账号与安全</strong><small>手机号、邮箱、密码与注销</small></span>
          <ChevronRight size={18} />
        </Link>
        <button type="button" disabled className="profile-menu-row disabled">
          <span><strong>通知偏好</strong><small>偏好接口尚未接入</small></span>
          <ChevronRight size={18} />
        </button>
        <Link to="/me/settings/profile" className="profile-menu-row">
          <span><strong>个人资料</strong><small>头像、昵称和简介</small></span>
          <ChevronRight size={18} />
        </Link>
        <button type="button" disabled className="profile-menu-row disabled">
          <span><strong>隐私政策</strong><small>页面尚未接入</small></span>
          <ChevronRight size={18} />
        </button>
        <button type="button" disabled className="profile-menu-row disabled">
          <span><strong>社区公约</strong><small>页面尚未接入</small></span>
          <ChevronRight size={18} />
        </button>
      </nav>
      <button type="button" className="logout-button" onClick={logout}>
        <LogOut size={16} /> 退出登录
      </button>
    </div>
  )
}
