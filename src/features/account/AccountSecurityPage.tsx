import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useState } from 'react'

import { useStoredSession } from '../session/session'
import {
  changeCurrentUserContact,
  deleteCurrentUser,
  sendVerificationCode,
  type VerificationChannel,
} from './api'

export function AccountSecurityPage() {
  const { session, saveSession } = useStoredSession()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState(session?.user.phone || '')
  const [phoneCode, setPhoneCode] = useState('')
  const [email, setEmail] = useState(session?.user.email || '')
  const [emailCode, setEmailCode] = useState('')
  const [editing, setEditing] = useState<VerificationChannel | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteCode, setDeleteCode] = useState('')
  const defaultDeleteChannel: VerificationChannel = session?.user.phone ? 'sms' : 'email'
  const [deleteChannel, setDeleteChannel] = useState<VerificationChannel>(defaultDeleteChannel)

  if (!session) {
    return (
      <div className="page signed-out-state">
        <strong>登录后管理账号</strong>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  const sendContactCode = async (channel: VerificationChannel, contact: string) => {
    setError('')
    setNotice('')
    try {
      await sendVerificationCode({
        data: {
          channel,
          purpose: channel === 'sms' ? 'modify_phone' : 'modify_email',
          ...(channel === 'sms' ? { phone: contact, phoneRegion: '86' } : { email: contact }),
        },
      })
      setNotice('验证码已发送。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败')
    }
  }

  const changeContact = async (channel: VerificationChannel) => {
    setBusy(true)
    setError('')
    try {
      const user = await changeCurrentUserContact({
        data: {
          token: session.token,
          channel,
          code: channel === 'sms' ? phoneCode : emailCode,
          ...(channel === 'sms' ? { phone, phoneRegion: '86' } : { email }),
        },
      })
      saveSession({ ...session, user })
      setNotice(channel === 'sms' ? '手机号已更新。' : '邮箱已更新。')
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '联系方式更新失败')
    } finally {
      setBusy(false)
    }
  }

  const sendDeleteCode = async () => {
    const contact = deleteChannel === 'sms' ? session.user.phone : session.user.email
    if (!contact) {
      setError('当前账号没有绑定这个联系方式。')
      return
    }
    setError('')
    try {
      await sendVerificationCode({
        data: {
          channel: deleteChannel,
          purpose: 'delete_account',
          ...(deleteChannel === 'sms'
            ? { phone: contact, phoneRegion: session.user.phone_region || '86' }
            : { email: contact }),
        },
      })
      setNotice('注销验证码已发送。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败')
    }
  }

  const removeAccount = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteCurrentUser({ data: { token: session.token, channel: deleteChannel, code: deleteCode } })
      saveSession(null)
      await navigate({ to: '/login' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号注销失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow-page account-security-page">
      <Link to="/me/settings" className="back-link"><ArrowLeft size={16} /> 设置</Link>
      <h1>账号与安全</h1>
      <section className="account-summary">
        <div className="account-summary-row">
          <span><small>登录方式</small><strong>Rice + AT Protocol</strong></span>
          <em>已验证</em>
        </div>
        <div className="account-summary-row">
          <span><small>手机号</small><strong>{maskedPhone(session.user.phone)}</strong></span>
          <button type="button" className="text-button" onClick={() => setEditing('sms')}>更换</button>
        </div>
        <div className="account-summary-row">
          <span><small>邮箱</small><strong>{maskedEmail(session.user.email)}</strong></span>
          <button type="button" className="text-button" onClick={() => setEditing('email')}>更换</button>
        </div>
        <div className="account-summary-row">
          <span><small>DID 标识</small><strong>{session.user.did}</strong></span>
        </div>
        <Link to="/forgot-password" className="account-summary-row">
          <span><small>密码</small><strong>通过已登记的联系方式重置</strong></span>
          <b>→</b>
        </Link>
      </section>

      {editing === 'sms' ? (
        <section className="form-card compact-form-card">
          <h2>更换手机号</h2>
          <label className="field-label"><span>新手机号</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label className="field-label code-field"><span>验证码</span><div><input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} /><button type="button" className="secondary-button" onClick={() => sendContactCode('sms', phone)}>获取验证码</button></div></label>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setEditing(null)}>取消</button>
            <button type="button" className="primary-button" disabled={!phone.trim() || !phoneCode.trim() || busy} onClick={() => changeContact('sms')}>确认更换</button>
          </div>
        </section>
      ) : null}

      {editing === 'email' ? (
        <section className="form-card compact-form-card">
          <h2>更换邮箱</h2>
          <label className="field-label"><span>新邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field-label code-field"><span>验证码</span><div><input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} /><button type="button" className="secondary-button" onClick={() => sendContactCode('email', email)}>获取验证码</button></div></label>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setEditing(null)}>取消</button>
            <button type="button" className="primary-button" disabled={!email.trim() || !emailCode.trim() || busy} onClick={() => changeContact('email')}>确认更换</button>
          </div>
        </section>
      ) : null}

      {notice ? <div className="form-notice">{notice}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <section className="danger-zone">
        <button type="button" className="danger-link" onClick={() => setDeleteOpen((value) => !value)}>注销账号</button>
        <p>永久删除账号与个人资料。操作需要验证码确认。</p>
        {deleteOpen ? (
          <div className="delete-account-form">
            <div className="task-warning-note"><CircleAlert size={18} /><span>注销后当前 Rice token 会立即失效。</span></div>
            <select value={deleteChannel} onChange={(event) => setDeleteChannel(event.target.value as VerificationChannel)}>
              <option value="sms" disabled={!session.user.phone}>手机号</option>
              <option value="email" disabled={!session.user.email}>邮箱</option>
            </select>
            <div className="code-inline"><input value={deleteCode} onChange={(event) => setDeleteCode(event.target.value)} placeholder="验证码" /><button type="button" className="secondary-button" onClick={sendDeleteCode}>获取验证码</button></div>
            <button type="button" className="danger-button" disabled={!deleteCode.trim() || busy} onClick={removeAccount}>确认注销账号</button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function maskedPhone(phone: string | null) {
  if (!phone) return '未绑定'
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function maskedEmail(email: string | null) {
  if (!email) return '未绑定'
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, 2)}***@${domain}`
}
