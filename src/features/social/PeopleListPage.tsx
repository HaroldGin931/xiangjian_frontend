import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { authorDisplayName } from '~/lib/format'
import { Avatar } from '~/components/Avatar'
import { AutoLoadMore } from '~/components/AutoLoadMore'
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
  const request = useRef(0)
  const title = kind === 'followers' ? '粉丝' : '关注'

  const load = async (cursor?: string) => {
    if (cursor && isLoading) return
    const currentRequest = request.current
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
      if (currentRequest !== request.current) return
      setPage((current) => cursor && current ? {
        subject: next.subject,
        profiles: [...new Map([...current.profiles, ...next.profiles].map((profile) => [profile.did, profile])).values()],
        cursor: next.cursor,
      } : next)
    } catch (reason) {
      if (currentRequest === request.current) setError(reason instanceof Error ? reason.message : `${title}列表暂时无法显示`)
    } finally {
      if (currentRequest === request.current) setLoading(false)
    }
  }

  useEffect(() => {
    ++request.current
    setPage(null)
    void load()
    return () => { ++request.current }
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
      {page?.cursor && <AutoLoadMore key={`${actor}:${kind}:${session?.pds.did}`} cursor={page.cursor} loading={isLoading} failed={!!error} onLoadMore={() => load(page.cursor)} />}
    </div>
  )
}
