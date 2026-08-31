import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { LogIn } from 'lucide-react'
import { useState } from 'react'

import { loginRice } from '~/lib/api'
import { useStoredSession } from '~/lib/session'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const login = useServerFn(loginRice)
  const { saveSession } = useStoredSession()
  const navigate = useNavigate()

  const submit = async () => {
    setError('')
    try {
      const session = await login({ data: { identifier, password } })
      saveSession(session)
      await navigate({ to: '/' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败')
    }
  }

  return (
    <div className="page narrow-page">
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
          label="账号"
          value={identifier}
          onChange={setIdentifier}
          placeholder="手机号、邮箱或用户名"
          width="100%"
          hasAutoFocus
        />
        <TextInput
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
          isDisabled={!identifier.trim() || !password}
          clickAction={submit}
        />
      </section>
    </div>
  )
}
