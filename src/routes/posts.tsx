import { createFileRoute } from '@tanstack/react-router'

import { PostThreadPanel } from '~/features/feed/PostThreadPanel'

export const Route = createFileRoute('/posts')({
  validateSearch: (search: Record<string, unknown>) => ({
    uri: typeof search.uri === 'string' ? search.uri : '',
  }),
  component: PostPage,
})

function PostPage() {
  const { uri } = Route.useSearch()
  const focusReply = typeof window !== 'undefined' && window.location.hash === '#reply'

  return (
    <div className="page post-page">
      <PostThreadPanel uri={uri} focusReply={focusReply} />
    </div>
  )
}
