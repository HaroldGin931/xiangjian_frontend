import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Avatar } from './Avatar'

export function ContentCardHeader({
  name,
  timestamp,
  profileActor,
  aside,
  avatarUrl,
  onAuthorClick,
}: {
  name: string
  timestamp: string
  profileActor?: string
  aside?: ReactNode
  avatarUrl?: string
  onAuthorClick?: () => void
}) {
  const author = (
    <>
      <Avatar name={name} src={avatarUrl} />
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
