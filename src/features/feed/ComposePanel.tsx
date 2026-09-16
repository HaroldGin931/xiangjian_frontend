import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ImagePicker } from '~/components/ContentImages'
import { readFileBase64 } from '~/lib/images'
import type { PdsImage } from '~/lib/models'
import { MAX_POST_IMAGE_BYTES, MAX_POST_IMAGES, newPostRecordKey } from '~/lib/pds'
import { LoginPage } from '../session/LoginPage'
import { getNodes } from '../nodes/api'
import { EventCreateForm } from '../events/EventCreateForm'
import { TaskCreatePage } from '../tasks/TaskCreatePage'
import { useStoredSession } from '../session/session'
import { createTextPost, createdPostView, prependCachedPost, uploadPostImage } from './api'

export type ComposeKind = 'post' | 'activity' | 'task'
export const composeKinds: Array<{ value: ComposeKind; label: string }> = [{ value: 'post', label: '发帖' }, { value: 'task', label: '发任务' }, { value: 'activity', label: '发活动' }]
export function ComposePanel({ initialKind = 'post', onPublished }: { initialKind?: ComposeKind; onPublished?: () => void }) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [kind, setKind] = useState(initialKind)
  const [canPublishCommunity, setCanPublishCommunity] = useState<boolean | null>(null)
  useEffect(() => {
    if (!session) return
    let active = true
    setCanPublishCommunity(null)
    // Managed nodes use the same owner check as task and activity creation.
    void getNodes({ data: { token: session.token, mine: 'managed' } })
      .then((nodes) => {
        if (!active) return
        const allowed = nodes.length > 0
        setCanPublishCommunity(allowed)
        if (!allowed) setKind('post')
      })
      .catch((reason) => {
        if (!active) return
        setCanPublishCommunity(false)
        setKind('post')
        setError(reason instanceof Error ? reason.message : '暂时无法加载发布选项')
      })
    return () => { active = false }
  }, [session?.token])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<Array<{ src: string; alt: string }>>([])
  const uploadedImages = useRef(new Map<File, PdsImage>())
  const postRequest = useRef<{ rkey: string; createdAt: string } | null>(null)
  useEffect(() => {
    const images = files.map((file) => ({ src: URL.createObjectURL(file), alt: file.name.replace(/\.[^.]+$/, '') }))
    setPreviews(images)
    return () => images.forEach((image) => URL.revokeObjectURL(image.src))
  }, [files])
  const submit = async () => {
    if (!session || (!text.trim() && !files.length) || busy) return
    setBusy(true); setError('')
    postRequest.current ??= { rkey: newPostRecordKey(), createdAt: new Date().toISOString() }
    try {
      const images: PdsImage[] = []
      for (const file of files) {
        let image = uploadedImages.current.get(file)
        if (!image) {
          const blob = await uploadPostImage({ data: { accessJwt: session.pds.access_jwt, contentType: file.type, base64: await readFileBase64(file) } })
          image = { image: blob, alt: file.name.replace(/\.[^.]+$/, '') }
          uploadedImages.current.set(file, image)
        }
        images.push(image)
      }
      const result = await createTextPost({ data: { did: session.pds.did, accessJwt: session.pds.access_jwt, text: text.trim(), category: 'post', images, ...postRequest.current } })
      if (!mounted.current) return
      prependCachedPost(createdPostView(result, session), session.pds.did)
      window.dispatchEvent(new Event('posts-changed'))
      if (onPublished) onPublished(); else await navigate({ to: '/' })
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '发布失败') } finally { if (mounted.current) setBusy(false) }
  }
  if (!isReady) return <p className="loading-line">正在加载…</p>
  if (!session) return <LoginPage />
  if (canPublishCommunity === null) return <p className="loading-line">正在加载发布选项…</p>
  const availableKinds = composeKinds.filter((item) => item.value === 'post' || canPublishCommunity)
  return <div className="page compose-page"><div className="compose-type-tabs filter-buttons" role="group" aria-label="发布类型">{availableKinds.map((item) => <Button label={item.label} variant="ghost" className={kind === item.value ? 'active' : undefined} aria-pressed={kind === item.value} onClick={() => setKind(item.value)} key={item.value} />)}</div>
    <div hidden={kind !== 'post'}><h2>发布帖子</h2><TextArea label="想分享什么" value={text} onChange={setText} rows={7} placeholder="分享社区里的见闻、想法或近况… 输入 #话题" width="100%" /><p className="compose-character-count">{text.trim().length}/300</p><ImagePicker images={previews} onSelect={(selected) => setFiles((current) => [...current, ...selected])} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} disabled={busy} maxImages={MAX_POST_IMAGES} maxBytes={MAX_POST_IMAGE_BYTES} />{error && <p className="form-error" role="alert">{error}</p>}<Button label="发布帖子" variant="primary" width="100%" isLoading={busy} isDisabled={!session || (!text.trim() && !files.length) || text.trim().length > 300 || busy} clickAction={submit} /></div>
    {canPublishCommunity && <div hidden={kind !== 'activity'}><h2>发布活动</h2><EventCreateForm onPublished={onPublished} /></div>}
    {canPublishCommunity && <div hidden={kind !== 'task'}><h2>发布任务</h2><TaskCreatePage embedded onPublished={onPublished} /></div>}
  </div>
}
