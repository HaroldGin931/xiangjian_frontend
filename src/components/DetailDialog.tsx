import { IconButton } from '@astryxdesign/core/IconButton'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const PanelReadiness = createContext<((id: string, pending: boolean) => void) | null>(null)

export function usePanelReady(ready: boolean) {
  const register = useContext(PanelReadiness)
  const id = useId()
  useLayoutEffect(() => {
    register?.(id, !ready)
    return () => register?.(id, false)
  }, [id, ready, register])
}

export function DetailDialog({ title, onClose, children, className = 'post-dialog business-dialog' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const pending = useRef(new Set<string>())
  const [revision, update] = useState(0)
  const [opened, setOpened] = useState(false)
  const register = useCallback((id: string, waiting: boolean) => {
    if (pending.current.has(id) === waiting) return
    if (waiting) pending.current.add(id)
    else pending.current.delete(id)
    update((value) => value + 1)
  }, [])
  useLayoutEffect(() => {
    if (!pending.current.size && !ref.current?.open) {
      ref.current?.showModal()
      setOpened(true)
    }
  }, [revision])
  useEffect(() => {
    const dialog = ref.current
    return () => dialog?.close()
  }, [])
  useEffect(() => {
    if (opened) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation(); onClose()
    }
    document.addEventListener('keydown', cancel, true)
    return () => document.removeEventListener('keydown', cancel, true)
  }, [opened, onClose])
  return <PanelReadiness.Provider value={register}>
    {!opened && <div className="panel-opening" role="status"><span>正在打开{title}…</span><button type="button" onClick={onClose}>取消</button></div>}
    <dialog ref={ref} className={className} aria-labelledby={titleId}
    onCancel={(event) => {
      if (event.target !== event.currentTarget) return
      event.preventDefault(); event.stopPropagation(); onClose()
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="post-dialog-shell">
      <header className="post-dialog-header"><strong id={titleId}>{title}</strong><IconButton label="关闭" icon={<X size={20} />} variant="ghost" onClick={onClose} /></header>
      <div className="post-dialog-scroll">{children}</div>
    </div>
  </dialog>
  </PanelReadiness.Provider>
}
