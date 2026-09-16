import { createRouter, Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    // Keep the current screen until the next route's required data is ready.
    defaultPendingMs: Infinity,
    defaultErrorComponent: RouteLoadError,
    scrollRestoration: true,
  })
}

function RouteLoadError({ reset }: ErrorComponentProps) {
  const router = useRouter()
  return <div className="page"><h1>页面暂时无法加载</h1><p role="alert">请检查网络后重试。</p><div className="button-row"><button type="button" className="primary-link" onClick={() => { void router.invalidate().then(reset) }}>重试</button><Link to="/">返回广场</Link></div></div>
}
