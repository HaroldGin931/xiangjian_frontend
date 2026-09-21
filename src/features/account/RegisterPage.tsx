import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useStoredSession } from '../session/session'
import { loginReturnTo } from '../session/login-redirect'
import { useAuthOptions } from '../session/useAuthOptions'
import {
  registerRice,
  verifyRegistration,
  type VerificationChannel,
} from './api'
import { VerificationFields } from './VerificationFields'

export function RegisterPage({ returnTo }: { returnTo?: string }) {
  const [channel, setChannel] = useState<VerificationChannel>('sms')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const { saveSession } = useStoredSession()
  const navigate = useNavigate()
  const { options, error: optionsError } = useAuthOptions()
  const channels = options?.registration_channels ?? []
  useEffect(() => {
    if (channels.length && !channels.includes(channel)) setChannel(channels[0])
  }, [options, channel])

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
      const session = await registerRice({ data: { ticket, nickname, password } })
      saveSession(session)
      await navigate({ href: loginReturnTo(returnTo), replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '注册失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow-page account-entry-page">
      <Link to="/login" search={{ returnTo }} className="back-link"><ArrowLeft size={16} /> 登录</Link>
      <section className="page-intro">
        <div className="eyebrow">一个身份，走遍全联盟</div>
        <h1>创建账号</h1>
        <p>验证联系方式，设置昵称和密码即可加入。</p>
      </section>
      <section className="form-card">
        <div className="login-icon"><UserPlus size={28} /></div>
        {optionsError ? <p className="form-error" role="alert">{optionsError}</p> : null}
        {options && !channels.length ? <p>注册暂未开放，请稍后再试。</p> : null}
        {options?.verification_mode === 'log' ? <p className="form-notice">测试模式：验证码仅写入服务器日志，不会发送短信或邮件。</p> : null}
        {channels.length ? <>
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
              channels={channels}
              disabled={busy}
              onError={setError}
              onSent={() => setNotice(options?.verification_mode === 'log' ? '测试验证码已写入服务器日志。' : '验证码已发送，请检查短信或邮箱。')}
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
              label="昵称"
              value={nickname}
              onChange={setNickname}
              placeholder="怎么称呼你"
              description="公开显示，可在个人资料中修改。"
              width="100%"
              isRequired
            />
            <TextInput
              label="密码"
              type="password"
              value={password}
              onChange={setPassword}
              description="至少 8 位。"
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
                isDisabled={!nickname.trim() || password.length < 8}
              />
            </div>
          </>
        )}
        </> : null}
        {error ? <div className="form-error" role="alert">{error}</div> : null}
      </section>
    </div>
  )
}
