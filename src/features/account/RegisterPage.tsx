import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { useState } from 'react'

import { useStoredSession } from '../session/session'
import {
  registerRice,
  verifyRegistration,
  type VerificationChannel,
} from './api'
import { VerificationFields } from './VerificationFields'

export function RegisterPage() {
  const [channel, setChannel] = useState<VerificationChannel>('sms')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const { saveSession } = useStoredSession()
  const navigate = useNavigate()

  const verify = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await verifyRegistration({
        data: {
          channel,
          code,
          ...(channel === 'sms' ? { phone: contact, phoneRegion: '86' } : { email: contact }),
        },
      })
      setTicket(result.ticket)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码校验失败')
    } finally {
      setBusy(false)
    }
  }

  const register = async () => {
    setBusy(true)
    setError('')
    try {
      const session = await registerRice({ data: { ticket, handle, password } })
      saveSession(session)
      await navigate({ to: '/' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '注册失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow-page account-entry-page">
      <Link to="/login" className="back-link"><ArrowLeft size={16} /> 登录</Link>
      <section className="page-intro">
        <div className="eyebrow">一个身份，走遍全联盟</div>
        <h1>创建账号</h1>
        <p>先验证手机号或邮箱，再创建 AT Protocol handle。</p>
      </section>
      <section className="form-card">
        <div className="login-icon"><UserPlus size={28} /></div>
        {!ticket ? (
          <>
            <VerificationFields
              channel={channel}
              setChannel={setChannel}
              contact={contact}
              setContact={setContact}
              code={code}
              setCode={setCode}
              purpose="register"
              disabled={busy}
              onError={setError}
              onSent={() => setNotice('验证码已发送，请检查短信或邮箱。')}
            />
            {notice ? <div className="form-notice">{notice}</div> : null}
            <div className="form-actions">
              <Button
                label="下一步"
                variant="primary"
                size="lg"
                clickAction={verify}
                isLoading={busy}
                isDisabled={!contact.trim() || !code.trim()}
              />
            </div>
          </>
        ) : (
          <>
            <TextInput
              label="Handle"
              value={handle}
              onChange={setHandle}
              placeholder="mo-name.local.xjdao.xyz"
              width="100%"
            />
            <TextInput
              label="密码"
              type="password"
              value={password}
              onChange={setPassword}
              description="至少 8 位。密码由 PDS 管理，Rice 不保存密码。"
              width="100%"
            />
            <div className="form-actions">
              <Button label="返回修改联系方式" variant="ghost" onClick={() => setTicket('')} />
              <Button
                label="完成注册"
                variant="primary"
                size="lg"
                clickAction={register}
                isLoading={busy}
                isDisabled={!handle.trim() || password.length < 8}
              />
            </div>
          </>
        )}
        {error ? <div className="form-error" role="alert">{error}</div> : null}
      </section>
    </div>
  )
}
