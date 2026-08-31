import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getCurrentUser } from '~/lib/api'
import type { RiceUser } from '~/lib/models'
import { useStoredSession } from '~/lib/session'

export const Route = createFileRoute('/me')({ component: MePage })

function MePage() {
  const { session, isReady } = useStoredSession()
  const fetchUser = useServerFn(getCurrentUser)
  const [user, setUser] = useState<RiceUser | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) {
      setUser(null)
      return
    }
    fetchUser({ data: session.token }).then(setUser).catch((reason) => {
      setError(reason instanceof Error ? reason.message : '读取用户失败')
    })
  }, [fetchUser, session])

  if (isReady && !session) {
    return (
      <div className="page narrow-page">
        <div className="empty-panel account-empty">
          <EmptyState
            icon={<UserRound size={34} />}
            title="还没有登录"
            description="登录 Rice 后，这里会展示真实账号与稻米信息。"
            actions={<Button label="前往登录" variant="primary" href="/login" />}
          />
        </div>
      </div>
    )
  }

  const profile = user ?? session?.user
  return (
    <div className="page">
      <section className="profile-hero">
        <div>
          <div className="eyebrow">Rice 账号</div>
          <h1>{profile?.nickname || profile?.handle || '正在读取账号'}</h1>
          <p>{profile?.handle}</p>
          {profile ? (
            <Badge
              variant={profile.node_member ? 'success' : 'neutral'}
              label={profile.node_member ? '节点成员' : '普通成员'}
            />
          ) : null}
        </div>
        <div className="profile-balance">
          <span>稻米余额</span>
          <strong>{profile?.grain_balance ?? '—'}</strong>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="profile-grid">
        <article>
          <span>身份 DID</span>
          <strong>{profile?.did || '—'}</strong>
          <p>来自 Rice 当前用户接口</p>
        </article>
        <article className="disabled-card">
          <span>我的任务</span>
          <strong>—</strong>
          <p>等待 Task API</p>
        </article>
        <article className="disabled-card">
          <span>任务权限</span>
          <strong>未确认</strong>
          <p>发布动作暂不开放</p>
        </article>
      </section>

      <section className="section-heading profile-section-heading">
        <h2>最近记录</h2>
      </section>
      <div className="empty-panel">
        <EmptyState
          title="没有填充演示记录"
          description="后续只展示由你实际产生、且已有明确读取接口的数据。"
        />
      </div>
    </div>
  )
}

