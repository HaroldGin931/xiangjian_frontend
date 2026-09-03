import { IconButton } from '@astryxdesign/core/IconButton'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { RepostChange } from '~/components/PostActions'

import { PostThreadPanel } from './PostThreadPanel'
import type { PostKind } from './tags'

export function PostThreadDialog({
  uri,
  kind,
  focusReply,
  onClose,
  onRepostChange,
  onReplyCreated,
  onPostDeleted,
}: {
  uri: string
  kind: PostKind
  focusReply: boolean
  onClose: () => void
  onRepostChange?: (change: RepostChange) => void
  onReplyCreated?: (postUri: string) => void
  onPostDeleted?: (postUri: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="post-dialog"
      aria-labelledby="post-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="post-dialog-shell">
        <header className="post-dialog-header">
          <strong id="post-dialog-title">
            {kind === 'activity' ? '活动' : kind === 'product' ? '商品' : '帖子'}
          </strong>
          <IconButton
            label="关闭详情"
            icon={<X size={20} aria-hidden="true" />}
            variant="ghost"
            onClick={onClose}
          />
        </header>
        <div className="post-dialog-scroll">
          <PostThreadPanel
            uri={uri}
            focusReply={focusReply}
            onRepostChange={onRepostChange}
            onReplyCreated={onReplyCreated}
            onPostDeleted={onPostDeleted}
          />
        </div>
      </div>
    </dialog>
  )
}
