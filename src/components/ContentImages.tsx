import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { ImagePlus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_IMAGE_MAX_BYTES, DEFAULT_IMAGE_MAX_COUNT, IMAGE_ACCEPT, imageSizeLabel, validateImageFiles } from '~/lib/images'
import '~/styles/images.css'

export type PreviewImage = { src: string; alt: string }

function ContentImage({ src, alt, loading, canRetry = false }: PreviewImage & { loading?: 'lazy'; canRetry?: boolean }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (failed) return <span className="content-image-failure" role="status">
    <span>图片暂时无法加载</span>
    {canRetry && <Button label="重试" variant="secondary" onClick={() => { setFailed(false); setAttempt(attempt + 1) }} />}
  </span>
  return <img key={attempt} src={src} alt={alt} loading={loading} onError={() => setFailed(true)} />
}

export function ImageCover({ images }: { images: PreviewImage[] }) {
  if (!images.length) return null
  return <span className="content-image-cover"><ContentImage key={images[0].src} {...images[0]} loading="lazy" /><span className="content-image-count">{images.length} 张图片</span></span>
}

export function ImageGroup({ images }: { images: PreviewImage[] }) {
  const [selected, setSelected] = useState<number | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  if (!images.length) return null
  return <>
    <div className="content-image-group" aria-label="图片">
      {images.map((image, index) => <button type="button" className="content-image-thumbnail" key={`${image.src}:${index}`} aria-label={`查看第 ${index + 1} 张图片${image.alt ? `：${image.alt}` : ''}`} onClick={(event) => { opener.current = event.currentTarget; setSelected(index) }}><ContentImage {...image} loading="lazy" /></button>)}
    </div>
    {selected !== null && <ImageViewer images={images} initialIndex={selected} opener={opener.current} onClose={() => setSelected(null)} />}
  </>
}

function ImageViewer({ images, initialIndex, opener, onClose }: { images: PreviewImage[]; initialIndex: number; opener: HTMLButtonElement | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [index, setIndex] = useState(initialIndex)
  const currentIndex = Math.min(index, images.length - 1)
  const image = images[currentIndex]
  const move = (delta: number) => setIndex(Math.max(0, Math.min(images.length - 1, currentIndex + delta)))
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close(); opener?.focus({ preventScroll: true }) }
  }, [opener])
  return createPortal(<dialog ref={dialogRef} className="post-dialog business-dialog content-image-viewer" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowLeft' ? -1 : 1) } }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
    }}>
    <div className="post-dialog-shell">
      <header className="post-dialog-header"><strong id={titleId}>查看图片</strong><IconButton label="关闭图片" icon={<X size={20} />} variant="ghost" onClick={onClose} /></header>
      <div className="content-image-stage"><ContentImage key={image.src} src={image.src} alt={image.alt || `第 ${currentIndex + 1} 张图片`} canRetry /></div>
      <footer className="content-image-controls"><Button label="上一张" variant="secondary" isDisabled={currentIndex === 0} onClick={() => move(-1)} /><span role="status" aria-live="polite">{currentIndex + 1} / {images.length}</span><Button label="下一张" variant="secondary" isDisabled={currentIndex === images.length - 1} onClick={() => move(1)} /></footer>
    </div>
  </dialog>, document.body)
}

export function ImagePicker({ images, onSelect, onRemove, disabled = false, maxImages = DEFAULT_IMAGE_MAX_COUNT, maxBytes = DEFAULT_IMAGE_MAX_BYTES, description }: {
  images: PreviewImage[]
  onSelect: (files: File[]) => void
  onRemove: (index: number) => void
  disabled?: boolean
  maxImages?: number
  maxBytes?: number
  description?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const full = images.length >= maxImages
  return <section className="content-image-picker" aria-label="添加图片">
    <label className="content-image-picker-label" htmlFor={id}>图片（选填）</label>
    {!!images.length && <div className="content-image-previews">{images.map((image, index) => <div className="content-image-preview" key={`${image.src}:${index}`}><img src={image.src} alt={image.alt} /><button type="button" className="content-image-remove" aria-label={`移除第 ${index + 1} 张图片`} disabled={disabled} onClick={() => { setError(null); onRemove(index) }}><X size={20} /></button></div>)}</div>}
    <label className={`content-image-add${disabled || full ? ' is-disabled' : ''}`}><ImagePlus size={22} /><span>{full ? `已添加 ${maxImages} 张图片` : '添加图片'}</span><input id={id} type="file" accept={IMAGE_ACCEPT} multiple disabled={disabled || full} aria-label="添加图片" aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`} onChange={(event) => {
      const files = Array.from(event.currentTarget.files || [])
      event.currentTarget.value = ''
      if (!files.length) return
      const failure = validateImageFiles(files, images.length, { maxImages, maxBytes })
      setError(failure)
      if (!failure) onSelect(files)
    }} /></label>
    <p id={helpId} className="content-image-help">最多 {maxImages} 张，每张不超过 {imageSizeLabel(maxBytes)}。支持 JPEG、PNG、WebP、GIF；图片按添加顺序显示。{description}</p>
    {error && <p id={errorId} className="content-image-error" role="alert">{error}</p>}
  </section>
}
