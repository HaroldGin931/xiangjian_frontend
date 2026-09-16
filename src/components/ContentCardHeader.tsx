import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { publicAttachmentUrl } from '~/lib/attachments'

export function ContentCardHeader({
  initial,
  name,
  timestamp,
  profileActor,
  aside,
  avatarUrl,
  onAuthorClick,
}: {
  initial: string
  name: string
  timestamp: string
  profileActor?: string
  aside?: ReactNode
  avatarUrl?: string
  onAuthorClick?: () => void
}) {
  const author = (
    <>
      <span className="content-card-avatar" aria-hidden="true">{avatarUrl ? <img src={publicAttachmentUrl(avatarUrl)} alt="" /> : initial}</span>
      <span className="content-card-author-copy">
        <strong>{name}</strong>
        <time className="content-card-time">{timestamp}</time>
      </span>
    </>
  )

  return (
    <header className="content-card-header">
      {onAuthorClick ? <button type="button" className="content-card-author" onClick={onAuthorClick}>{author}</button> : profileActor ? (
        <Link
          to="/profile/$actor"
          params={{ actor: profileActor }}
          className="content-card-author"
        >
          {author}
        </Link>
      ) : (
        <span className="content-card-author">{author}</span>
      )}
      {aside}
    </header>
  )
}
