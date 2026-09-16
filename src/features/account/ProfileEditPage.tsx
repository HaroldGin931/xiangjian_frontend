import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Avatar } from '~/components/Avatar'
import { usePanelReady } from '~/components/DetailDialog'

import { useStoredSession } from '../session/session'
import { updateCurrentUser, uploadRiceAttachment } from './api'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function ProfileEditPage({ onSaved }: { onSaved?: () => void }) {
  const { session, isReady, saveSession } = useStoredSession()
  usePanelReady(isReady)
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(session?.user.nickname || '')
  const [bio, setBio] = useState(session?.user.bio || '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!avatar) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(avatar)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatar])

  if (!session) {
    return <LoginRequired />
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
      if (onSaved) onSaved(); else await navigate({ to: '/me' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '资料保存失败')
    } finally {
      setBusy(false)
    }
  }

  const avatarUrl = preview || session.user.avatar?.url

  return (
    <div className="page narrow-page profile-edit-page">
      {!onSaved && <Link to="/me/settings" className="back-link"><ArrowLeft size={16} /> 设置</Link>}
      <h1>个人资料</h1>
      <section className="form-card">
        <Avatar name={nickname || session.user.handle} src={avatarUrl} size="large" />
        <FileInput
          label="头像"
          placeholder="选择图片"
          value={avatar}
          onChange={(file) => setAvatar(file as File | null)}
          accept="image/png,image/jpeg,image/gif,image/webp"
          maxSize={MAX_AVATAR_BYTES}
          description="支持 PNG、JPEG、GIF 或 WebP，最大 5MB。"
          width="100%"
          isOptional
        />
        <TextInput
          label="昵称"
          value={nickname}
          onChange={(value) => setNickname(value.slice(0, 64))}
          width="100%"
        />
        <TextArea
          label="简介"
          value={bio}
          onChange={setBio}
          maxLength={512}
          rows={6}
          width="100%"
        />
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <Button
          label="保存"
          variant="primary"
          size="lg"
          width="100%"
          clickAction={save}
          isLoading={busy}
        />
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
