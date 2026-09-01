import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { RepostChange } from '~/components/PostActions'

import { PostThreadPanel } from './PostThreadPanel'

export function PostThreadDialog({
  uri,
  focusReply,
  onClose,
  onRepostChange,
}: {
  uri: string
  focusReply: boolean
  onClose: () => void
  onRepostChange?: (change: RepostChange) => void
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
          <strong id="post-dialog-title">帖子</strong>
          <button type="button" aria-label="关闭帖子" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="post-dialog-scroll">
          <PostThreadPanel
            uri={uri}
            focusReply={focusReply}
            onRepostChange={onRepostChange}
          />
        </div>
      </div>
    </dialog>
  )
}
