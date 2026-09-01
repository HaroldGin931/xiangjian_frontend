import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Camera, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { publicAttachmentUrl } from '~/lib/attachments'

import { useStoredSession } from '../session/session'
import { updateCurrentUser, uploadRiceAttachment } from './api'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function ProfileEditPage() {
  const { session, saveSession } = useStoredSession()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(session?.user.nickname || '')
  const [bio, setBio] = useState(session?.user.bio || '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  if (!session) {
    return <LoginRequired />
  }

  const chooseAvatar = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_AVATAR_BYTES) {
      setError('请选择 5MB 以内的图片。')
      return
    }
    setError('')
    setAvatar(file)
    setPreview(URL.createObjectURL(file))
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const attachment = avatar
        ? await uploadRiceAttachment({
            data: {
              token: session.token,
              filename: avatar.name,
              contentType: avatar.type,
              base64: await fileToBase64(avatar),
            },
          })
        : null
      const user = await updateCurrentUser({
        data: {
          token: session.token,
          nickname,
          bio,
          avatarId: attachment?.id,
        },
      })
      saveSession({ ...session, user })
      await navigate({ to: '/me' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '资料保存失败')
    } finally {
      setBusy(false)
    }
  }

  const avatarUrl = preview || (session.user.avatar ? publicAttachmentUrl(session.user.avatar.url) : '')

  return (
    <div className="page narrow-page profile-edit-page">
      <Link to="/me/settings" className="back-link"><ArrowLeft size={16} /> 设置</Link>
      <h1>个人资料</h1>
      <section className="form-card">
        <label className="avatar-picker">
          {avatarUrl ? <img src={avatarUrl} alt="当前头像" /> : <UserRound size={34} />}
          <span><Camera size={15} /> 点击更换</span>
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
        </label>
        <label className="field-label">
          <span>昵称</span>
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={64} />
        </label>
        <label className="field-label">
          <span>简介</span>
          <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={512} rows={6} />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button type="button" className="primary-button" disabled={busy} onClick={save}>{busy ? '正在保存…' : '保存'}</button>
      </section>
    </div>
  )
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function LoginRequired() {
  return (
    <div className="page signed-out-state">
      <strong>登录后编辑资料</strong>
      <Link to="/login" className="primary-link">前往登录</Link>
    </div>
  )
}
