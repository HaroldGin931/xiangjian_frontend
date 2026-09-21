import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { ImagePicker } from '~/components/ContentImages'
import { DetailDialog, usePanelReady } from '~/components/DetailDialog'
import { preparePostImage, readFileBase64 } from '~/lib/images'
import type { PdsImage } from '~/lib/models'
import type { FormCloseState } from '~/lib/form-state'
import { MAX_POST_IMAGE_BYTES, MAX_POST_IMAGES, newPostRecordKey } from '~/lib/pds'
import { LoginPage } from '../session/LoginPage'
import { getNodes, type CommunityNode } from '../nodes/api'
import { EventCreateForm } from '../events/EventCreateForm'
import { TaskCreatePage } from '../tasks/TaskCreatePage'
import { useStoredSession } from '../session/session'
import { createTextPost, createdPostView, prependCachedPost, uploadPostImage } from './api'
import { deletePostDraft, readPostDraft, savePostDraft } from './post-draft'

export type ComposeKind = 'post' | 'activity' | 'task'
export const composeKinds: Array<{ value: ComposeKind; label: string }> = [{ value: 'post', label: '发帖' }, { value: 'task', label: '发任务' }, { value: 'activity', label: '发活动' }]
export type ComposeHandle = { requestClose: () => void }
type ComposePanelProps = { initialKind?: ComposeKind; onPublished?: () => void; onClose?: () => void; ref?: Ref<ComposeHandle> }
export function ComposePanel(props: ComposePanelProps) {
  const { session } = useStoredSession()
  return <ComposeContent key={session?.user.id ?? 'guest'} {...props} />
}

function ComposeContent({ initialKind = 'post', onPublished, onClose, ref }: ComposePanelProps) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [kind, setKind] = useState(initialKind)
  const [visitedKinds, setVisitedKinds] = useState<ComposeKind[]>([initialKind])
  const [managedNodes, setManagedNodes] = useState<CommunityNode[] | null>(null)
  usePanelReady(isReady && (!session || managedNodes !== null))
  useEffect(() => {
    if (!session) return
    let active = true
    setManagedNodes(null)
    // Managed nodes use the same owner check as task and activity creation.
    void getNodes({ data: { token: session.token, mine: 'managed' } })
      .then((nodes) => {
        if (!active) return
        const allowed = nodes.length > 0
        setManagedNodes(nodes)
        if (!allowed) setKind('post')
      })
      .catch((reason) => {
        if (!active) return
        setManagedNodes([])
        setKind('post')
        setError(reason instanceof Error ? reason.message : '暂时无法加载发布选项')
      })
    return () => { active = false }
  }, [session?.token])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [savedPost, setSavedPost] = useState<{ text: string; files: File[] }>({ text: '', files: [] })
  const [postDraftStored, setPostDraftStored] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [savingDrafts, setSavingDrafts] = useState(false)
  const [closeError, setCloseError] = useState('')
  const decision = useRef<((leave: boolean) => void) | null>(null)
  const [notice, setNotice] = useState('')
  const [childStates, setChildStates] = useState<Record<'activity' | 'task', FormCloseState>>({ activity: { dirty: false, busy: false }, task: { dirty: false, busy: false } })
  const updateActivity = useCallback((state: FormCloseState) => setChildStates(current => current.activity.dirty === state.dirty && current.activity.busy === state.busy ? current : { ...current, activity: state }), [])
  const updateTask = useCallback((state: FormCloseState) => setChildStates(current => current.task.dirty === state.dirty && current.task.busy === state.busy ? current : { ...current, task: state }), [])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<Array<{ src: string; alt: string }>>([])
  const uploadedImages = useRef(new Map<File, PdsImage>())
  const postRequest = useRef<{ rkey: string; createdAt: string } | null>(null)
  usePanelReady(isReady && (!session || draftReady))
  useEffect(() => {
    if (!session) return
    let active = true
    void readPostDraft(session.pds.did).then(draft => {
      if (!active || !draft) return
      setText(draft.text); setFiles(draft.files); setSavedPost(draft); postRequest.current = draft.request
      setPostDraftStored(true)
      setNotice('已恢复帖子草稿（保存在当前浏览器）。')
    }).catch(() => { if (active) setError('无法读取帖子草稿，请检查浏览器存储权限。') })
      .finally(() => { if (active) setDraftReady(true) })
    return () => { active = false }
  }, [session?.pds.did])
  useEffect(() => () => decision.current?.(false), [])
  const dirtyPost = text !== savedPost.text || files.length !== savedPost.files.length || files.some((file, index) => file !== savedPost.files[index])
  const dirty = dirtyPost || childStates.activity.dirty || childStates.task.dirty
  const submitting = busy || savingDrafts || childStates.activity.busy || childStates.task.busy
  const closeState = useRef<FormCloseState>({ dirty: false, busy: false })
  useEffect(() => { closeState.current = { dirty, busy: submitting } }, [dirty, submitting])
  const requestLeave = async () => {
    if (closeState.current.busy || decision.current) return false
    if (!closeState.current.dirty) return true
    setCloseError(''); setConfirmClose(true)
    return new Promise<boolean>(resolve => { decision.current = resolve })
  }
  useImperativeHandle(ref, () => ({ requestClose: () => { void requestLeave().then(leave => { if (leave) onClose?.() }) } }))
  useBlocker({
    shouldBlockFn: async () => !(await requestLeave()),
    enableBeforeUnload: () => closeState.current.dirty || closeState.current.busy,
  })
  const finishClose = (leave: boolean) => {
    const resolve = decision.current
    decision.current = null
    setConfirmClose(false)
    resolve?.(leave)
  }
  const saveAndClose = async () => {
    if (!session || savingDrafts) return
    setSavingDrafts(true); setCloseError('')
    try {
      if (dirtyPost) {
        const hasContent = Boolean(text.trim() || files.length)
        if (hasContent) await savePostDraft(session.pds.did, { text, files, request: postRequest.current })
        else await deletePostDraft(session.pds.did)
        if (!mounted.current) return
        setSavedPost({ text, files })
        setPostDraftStored(hasContent)
      }
      for (const type of ['task', 'activity'] as const) {
        if (childStates[type].dirty && !(await childStates[type].saveDraft?.())) {
          setKind(type)
          throw new Error(`${type === 'task' ? '任务' : '活动'}草稿未保存，请关闭此提示并检查表单中的错误。`)
        }
      }
      if (mounted.current) finishClose(true)
    } catch (reason) {
      if (mounted.current) setCloseError(reason instanceof Error ? reason.message : '草稿保存失败，内容仍保留在窗口中，请重试。')
    } finally { if (mounted.current) setSavingDrafts(false) }
  }
  const published = async (publishedKind: ComposeKind, taskId?: string) => {
    const remaining = composeKinds.filter(item => item.value !== publishedKind && (item.value === 'post' ? dirtyPost : childStates[item.value].dirty))
    if (publishedKind !== 'post') {
      setChildStates(current => ({ ...current, [publishedKind]: { dirty: false, busy: false } }))
      setVisitedKinds(current => current.filter(value => value !== publishedKind))
    }
    if (remaining.length) { setKind(remaining[0].value); setNotice('发布成功，其他类型的未保存内容已保留。'); return }
    closeState.current = { dirty: false, busy: false }
    if (onPublished) onPublished()
    else if (publishedKind === 'task' && taskId) await navigate({ to: '/tasks/$taskId', params: { taskId } })
    else await navigate({ to: publishedKind === 'activity' ? '/events' : '/' })
  }
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
      // Persist the retry key before publishing a restored draft, including uncertain responses.
      if (postDraftStored) {
        await savePostDraft(session.pds.did, { text, files, request: postRequest.current })
        if (!mounted.current) return
        setSavedPost({ text, files })
      }
      const images: PdsImage[] = []
      for (const file of files) {
        let image = uploadedImages.current.get(file)
        if (!image) {
          const prepared = await preparePostImage(file, MAX_POST_IMAGE_BYTES)
          const blob = await uploadPostImage({ data: { accessJwt: session.pds.access_jwt, contentType: prepared.type, base64: await readFileBase64(prepared) } })
          image = { image: blob, alt: file.name.replace(/\.[^.]+$/, '') }
          uploadedImages.current.set(file, image)
        }
        images.push(image)
      }
      const result = await createTextPost({ data: { did: session.pds.did, accessJwt: session.pds.access_jwt, text: text.trim(), category: 'post', images, ...postRequest.current } })
      if (postDraftStored) await deletePostDraft(session.pds.did)
      if (!mounted.current) return
      prependCachedPost(createdPostView(result, session), session.pds.did)
      window.dispatchEvent(new Event('posts-changed'))
      setText(''); setFiles([]); setSavedPost({ text: '', files: [] }); setPostDraftStored(false); uploadedImages.current.clear(); postRequest.current = null
      await published('post')
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '发布失败') } finally { if (mounted.current) setBusy(false) }
  }
  if (!isReady) return <p className="loading-line">正在加载…</p>
  if (!session) return <LoginPage />
  if (managedNodes === null || !draftReady) return <p className="loading-line">正在恢复发布内容…</p>
  const canPublishCommunity = managedNodes.length > 0
  const availableKinds = composeKinds.filter((item) => item.value === 'post' || canPublishCommunity)
  const selectKind = (value: ComposeKind) => { setKind(value); setVisitedKinds((visited) => visited.includes(value) ? visited : [...visited, value]) }
  return <div className="page compose-page">{availableKinds.length > 1 && <div className="compose-type-tabs filter-buttons" role="group" aria-label="发布类型">{availableKinds.map((item) => <Button label={item.label} variant="ghost" className={kind === item.value ? 'active' : undefined} aria-pressed={kind === item.value} isDisabled={submitting} onClick={() => selectKind(item.value)} key={item.value} />)}</div>}{notice && <p className="form-notice" role="status">{notice}</p>}
    <div hidden={kind !== 'post'}><h2>发布帖子</h2><div className="form-stack"><div><TextArea isDisabled={busy} label="想分享什么" value={text} onChange={setText} rows={7} placeholder="分享社区里的见闻、想法或近况… 输入 #话题" width="100%" /><p className="compose-character-count">{text.trim().length}/300</p></div><ImagePicker images={previews} onSelect={(selected) => setFiles((current) => [...current, ...selected])} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} disabled={busy} maxImages={MAX_POST_IMAGES} description="静态大图会自动压缩；GIF 动图需在 1 MB 以内。" />{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button label="发布帖子" variant="primary" isLoading={busy} isDisabled={!session || (!text.trim() && !files.length) || text.trim().length > 300 || busy} clickAction={submit} /></div></div></div>
    {canPublishCommunity && visitedKinds.includes('activity') && <div hidden={kind !== 'activity'}><h2>发布活动</h2><EventCreateForm key={session.token} session={session} nodes={managedNodes} active={kind === 'activity'} onPublished={() => { void published('activity') }} onCloseStateChange={updateActivity} /></div>}
    {canPublishCommunity && visitedKinds.includes('task') && <div hidden={kind !== 'task'}><h2>发布任务</h2><TaskCreatePage key={session.token} session={session} nodes={managedNodes} active={kind === 'task'} onPublished={id => { void published('task', id) }} onCloseStateChange={updateTask} /></div>}
    {confirmClose && <DetailDialog title="保存草稿" className="post-dialog business-dialog compose-close-dialog" onClose={() => { if (!savingDrafts) finishClose(false) }}><div className="business-panel form-stack"><p>有内容尚未保存。请问是保存草稿还是直接关闭？</p>{dirtyPost && <p className="muted">帖子草稿含图片，仅保存在当前浏览器，重新打开发布窗口可继续编辑。</p>}{closeError && <p className="form-error" role="alert">{closeError}</p>}<div className="form-actions"><Button label="直接关闭" variant="secondary" isDisabled={savingDrafts} clickAction={() => finishClose(true)} /><Button label="保存草稿" variant="primary" isLoading={savingDrafts} isDisabled={savingDrafts} clickAction={saveAndClose} /></div></div></DetailDialog>}
  </div>
}
