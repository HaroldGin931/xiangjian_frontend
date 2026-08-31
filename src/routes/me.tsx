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
      setError(reason instanceof Error ? reason.message : '暂时无法加载账号信息')
    })
  }, [fetchUser, session])

  if (isReady && !session) {
    return (
      <div className="page narrow-page">
        <div className="empty-panel account-empty">
          <EmptyState
            icon={<UserRound size={34} />}
            title="还没有登录"
            description="登录后查看账号信息与参与记录。"
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
          <div className="eyebrow">个人中心</div>
          <h1>{profile?.nickname || profile?.handle || '正在加载'}</h1>
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
          <span>账号</span>
          <strong>{profile?.handle || '—'}</strong>
          <p>{profile?.node_member ? '节点成员' : '社区成员'}</p>
        </article>
        <article className="disabled-card">
          <span>我的任务</span>
          <strong>—</strong>
        </article>
        <article className="disabled-card">
          <span>参与项目</span>
          <strong>—</strong>
        </article>
      </section>

      <section className="section-heading profile-section-heading">
        <h2>最近记录</h2>
      </section>
      <div className="empty-panel">
        <EmptyState
          title="还没有记录"
          description="参与社区后，你的动态会显示在这里。"
        />
      </div>
    </div>
  )
}
