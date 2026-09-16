import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { authorDisplayName } from '~/lib/format'
import { Avatar } from '~/components/Avatar'
import type { SocialConnectionPage } from '~/lib/models'

import { useStoredSession } from '../session/session'
import {
  getSocialConnections,
  type SocialConnectionKind,
} from './api'

export function PeopleListPage({
  actor,
  kind,
}: {
  actor: string
  kind: SocialConnectionKind
}) {
  const { session } = useStoredSession()
  const [page, setPage] = useState<SocialConnectionPage | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setLoading] = useState(false)
  const title = kind === 'followers' ? '粉丝' : '关注'

  const load = async (cursor?: string) => {
    setLoading(true)
    setError('')
    try {
      const next = await getSocialConnections({
        data: {
          actor,
          kind,
          ...(cursor ? { cursor } : {}),
          accessJwt: session?.pds.access_jwt,
        },
      })
      setPage((current) => cursor && current ? {
        subject: next.subject,
        profiles: [...current.profiles, ...next.profiles],
        cursor: next.cursor,
      } : next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${title}列表暂时无法显示`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(null)
    void load()
    // load only when the route or active PDS session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, kind, session?.pds.access_jwt])

  return (
    <div className="page people-list-page">
      <header className="standalone-header social-page-header">
        <Link to="/profile/$actor" params={{ actor }} className="back-link" aria-label="返回用户主页">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <strong>{page ? `${authorDisplayName(page.subject)}的${title}` : title}</strong>
      </header>

      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {page?.profiles.length ? (
        <div className="people-list">
          {page.profiles.map((profile) => (
            <Link
              to="/profile/$actor"
              params={{ actor: profile.did }}
              className="person-row"
              key={profile.did}
            >
              <Avatar name={authorDisplayName(profile)} src={profile.avatar} />
              <span className="person-copy">
                <strong>{authorDisplayName(profile)}</strong>
                <small>@{profile.handle}</small>
                {profile.description ? <p>{profile.description}</p> : null}
              </span>
            </Link>
          ))}
          {page.cursor ? (
            <div className="people-load-more">
              <Button
                label="加载更多"
                variant="secondary"
                clickAction={() => load(page.cursor)}
                isLoading={isLoading}
              />
            </div>
          ) : null}
        </div>
      ) : page && !error ? (
        <div className="empty-panel">
          <EmptyState
            title={kind === 'followers' ? '还没有粉丝' : '还没有关注任何人'}
            description="这里会显示真实的关注关系。"
          />
        </div>
      ) : !error ? (
        <p className="loading-line">正在加载{title}列表…</p>
      ) : null}
    </div>
  )
}
