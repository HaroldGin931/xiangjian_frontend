import { createFileRoute } from '@tanstack/react-router'
import { LoginPage } from '~/features/session/LoginPage'

export const Route = createFileRoute('/login')({ component: LoginPage })
