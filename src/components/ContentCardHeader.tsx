import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function ContentCardHeader({
  initial,
  name,
  timestamp,
  profileActor,
  aside,
}: {
  initial: string
  name: string
  timestamp: string
  profileActor?: string
  aside?: ReactNode
}) {
  const author = (
    <>
      <span className="content-card-avatar" aria-hidden="true">{initial}</span>
      <span className="content-card-author-copy">
        <strong>{name}</strong>
        <time className="content-card-time">{timestamp}</time>
      </span>
    </>
  )

  return (
    <header className="content-card-header">
      {profileActor ? (
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
