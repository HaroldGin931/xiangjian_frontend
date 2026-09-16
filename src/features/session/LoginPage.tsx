import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { useRef, useState } from 'react'

import { loginRice } from '~/features/session/api'
import { useStoredSession } from '~/features/session/session'

export function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const identifierInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const { saveSession } = useStoredSession()
  const navigate = useNavigate()

  const submit = async () => {
    const submittedIdentifier = identifierInput.current?.value.trim() || identifier.trim()
    const submittedPassword = passwordInput.current?.value || password
    if (!submittedIdentifier || !submittedPassword) {
      setError('请输入账号和密码')
      return
    }
    setError('')
    try {
      const session = await loginRice({
        data: { identifier: submittedIdentifier, password: submittedPassword },
      })
      saveSession(session)
      await navigate({ to: '/' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败')
    }
  }

  return (
    <div className="page narrow-page account-entry-page">
      <section className="page-intro">
        <div className="eyebrow">欢迎回来</div>
        <h1>登录</h1>
        <p>登录后即可发布内容、参与社区互动。</p>
      </section>

      <section className="login-card">
        <div className="login-icon" aria-hidden="true">
          <LogIn size={30} />
        </div>
        <TextInput
          ref={identifierInput}
          label="账号"
          value={identifier}
          onChange={setIdentifier}
          placeholder="手机号、邮箱或用户名"
          width="100%"
          hasAutoFocus
        />
        <TextInput
          ref={passwordInput}
          label="密码"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="输入密码"
          width="100%"
          onEnter={submit}
        />
        {error ? <div className="form-error">{error}</div> : null}
        <Button
          label="登录"
          variant="primary"
          size="lg"
          width="100%"
          clickAction={submit}
        />
        <div className="login-links">
          <Link to="/register">创建账号</Link>
          <Link to="/forgot-password">忘记密码？</Link>
        </div>
      </section>
    </div>
  )
}
