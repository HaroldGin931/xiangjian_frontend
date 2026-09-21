import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function LoginLink({ children, className }: { children: ReactNode; className?: string }) {
  const returnTo = useRouterState({ select: (state) => state.location.href })
  return <Link to="/login" search={{ returnTo }} className={className}>{children}</Link>
}
