import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { RiceAttachment, RiceSession, RiceUser } from '~/lib/models'

export type VerificationChannel = 'sms' | 'email'
export type VerificationPurpose =
  | 'register'
  | 'reset_password'
  | 'modify_phone'
  | 'modify_email'
  | 'delete_account'

type ContactInput = {
  channel: VerificationChannel
  phone?: string
  phoneRegion?: string
  email?: string
}

const contactBody = (data: ContactInput) => data.channel === 'sms'
  ? { phone: data.phone?.trim(), phone_region: data.phoneRegion || '86' }
  : { email: data.email?.trim().toLowerCase() }

export const sendVerificationCode = createServerFn({ method: 'POST' })
  .validator((data: ContactInput & { purpose: VerificationPurpose }) => data)
  .handler(async ({ data }) => {
    await requestJson(`${BACKEND_BASE}/api/verification_codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: data.channel, ...contactBody(data), purpose: data.purpose }),
    })
    return true
  })

export const verifyRegistration = createServerFn({ method: 'POST' })
  .validator((data: ContactInput & { code: string }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: { ticket: string; expires_in: number } }>(
      `${BACKEND_BASE}/api/registrations/verification`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: data.channel, ...contactBody(data), code: data.code.trim() }),
      },
    )
    return body.data
  })

export const registerRice = createServerFn({ method: 'POST' })
  .validator((data: { ticket: string; handle: string; password: string }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceSession }>(`${BACKEND_BASE}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket: data.ticket,
        handle: data.handle.trim().toLowerCase(),
        password: data.password,
      }),
    })
    return body.data
  })

export const resetRicePassword = createServerFn({ method: 'POST' })
  .validator((data: ContactInput & { code: string; password: string }) => data)
  .handler(async ({ data }) => {
    await requestJson(`${BACKEND_BASE}/api/passwords/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: data.channel,
        ...contactBody(data),
        code: data.code.trim(),
        password: data.password,
      }),
    })
    return true
  })

export const updateCurrentUser = createServerFn({ method: 'POST' })
  .validator((data: {
    token: string
    nickname: string
    bio: string
    avatarId?: string
  }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceUser }>(`${BACKEND_BASE}/api/users/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: data.nickname,
        bio: data.bio,
        ...(data.avatarId ? { avatar_id: data.avatarId } : {}),
      }),
    })
    return body.data
  })

export const uploadRiceAttachment = createServerFn({ method: 'POST' })
  .validator((data: {
    token: string
    filename: string
    contentType: string
    base64: string
  }) => data)
  .handler(async ({ data }) => {
    const form = new FormData()
    form.append('kind', 'image')
    form.append(
      'file',
      new Blob([Buffer.from(data.base64, 'base64')], { type: data.contentType }),
      data.filename,
    )
    const body = await requestJson<{ data: RiceAttachment }>(`${BACKEND_BASE}/api/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.token}` },
      body: form,
    })
    return body.data
  })

export const changeCurrentUserContact = createServerFn({ method: 'POST' })
  .validator((data: ContactInput & { token: string; code: string }) => data)
  .handler(async ({ data }) => {
    const kind = data.channel === 'sms' ? 'phone' : 'email'
    const body = await requestJson<{ data: RiceUser }>(`${BACKEND_BASE}/api/users/me/${kind}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...contactBody(data), code: data.code.trim() }),
    })
    return body.data
  })

export const deleteCurrentUser = createServerFn({ method: 'POST' })
  .validator((data: { token: string; channel: VerificationChannel; code: string }) => data)
  .handler(async ({ data }) => {
    await requestJson(`${BACKEND_BASE}/api/users/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: data.channel, code: data.code.trim() }),
    })
    return true
  })
