import { DetailDialog } from '~/components/DetailDialog'
import type { RepostChange } from '~/components/PostActions'

import { PostThreadPanel } from './PostThreadPanel'
import type { PostCategory } from '~/lib/models'

export function PostThreadDialog({
  uri,
  category,
  focusReply,
  onClose,
  onRepostChange,
  onReplyCreated,
  onPostDeleted,
}: {
  uri: string
  category: PostCategory
  focusReply: boolean
  onClose: () => void
  onRepostChange?: (change: RepostChange) => void
  onReplyCreated?: (postUri: string) => void
  onPostDeleted?: (postUri: string) => void
}) {
  return (
    <DetailDialog
      className="post-dialog"
      title={category === 'activity' ? '活动' : category === 'product' ? '商品' : '帖子'}
      onClose={onClose}
    >
      <PostThreadPanel
        uri={uri}
        focusReply={focusReply}
        onRepostChange={onRepostChange}
        onReplyCreated={onReplyCreated}
        onPostDeleted={onPostDeleted}
      />
    </DetailDialog>
  )
}
