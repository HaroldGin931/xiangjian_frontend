import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'

import type { RiceTask, TaskMine, TaskStatus } from './types'

type TaskListInput = {
  token?: string
  mine?: TaskMine
  status?: TaskStatus
  participantDid?: string
  creatorDid?: string
  limit?: number
}

const authHeaders = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined

export const getTasks = createServerFn({ method: 'POST' })
  .validator((data: TaskListInput) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams()
    if (data.mine) query.set('mine', data.mine)
    if (data.status) query.set('status', data.status)
    if (data.participantDid) query.set('participant_did', data.participantDid)
    if (data.creatorDid) query.set('creator_did', data.creatorDid)
    if (data.limit) query.set('limit', String(data.limit))
    const suffix = query.size ? `?${query}` : ''
    const body = await requestJson<{ data: RiceTask[] }>(`${BACKEND_BASE}/api/tasks${suffix}`, {
      headers: authHeaders(data.token),
    })
    return body.data
  })

export const getTask = createServerFn({ method: 'POST' })
  .validator((data: { id: string; token?: string }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceTask }>(`${BACKEND_BASE}/api/tasks/${data.id}`, {
      headers: authHeaders(data.token),
    })
    return body.data
  })

export const createTask = createServerFn({ method: 'POST' })
  .validator((data: {
    token: string
    title: string
    description: string
    status: 'draft' | 'open'
    applicationDeadline?: string
  }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceTask }>(`${BACKEND_BASE}/api/tasks`, {
      method: 'POST',
      headers: { ...authHeaders(data.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        status: data.status,
        application_deadline: data.applicationDeadline,
      }),
    })
    return body.data
  })

export const updateTaskDraft = createServerFn({ method: 'POST' })
  .validator((data: {
    token: string
    taskId: string
    title: string
    description: string
    applicationDeadline: string | null
  }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceTask }>(`${BACKEND_BASE}/api/tasks/${data.taskId}`, {
      method: 'PATCH',
      headers: { ...authHeaders(data.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        application_deadline: data.applicationDeadline,
      }),
    })
    return body.data
  })

const taskAction = async (token: string, taskId: string, action: 'publish' | 'cancel') => {
  const body = await requestJson<{ data: RiceTask }>(
    `${BACKEND_BASE}/api/tasks/${taskId}/${action}`,
    { method: 'POST', headers: authHeaders(token) },
  )
  return body.data
}

export const publishTask = createServerFn({ method: 'POST' })
  .validator((data: { token: string; taskId: string }) => data)
  .handler(({ data }) => taskAction(data.token, data.taskId, 'publish'))

export const cancelTask = createServerFn({ method: 'POST' })
  .validator((data: { token: string; taskId: string }) => data)
  .handler(({ data }) => taskAction(data.token, data.taskId, 'cancel'))

export const applyForTask = createServerFn({ method: 'POST' })
  .validator((data: { token: string; taskId: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceTask }>(
      `${BACKEND_BASE}/api/tasks/${data.taskId}/applications`,
      {
        method: 'POST',
        headers: { ...authHeaders(data.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: data.reason }),
      },
    )
    return body.data
  })

export const appointTaskApplication = createServerFn({ method: 'POST' })
  .validator((data: {
    token: string
    taskId: string
    applicationId: string
    appointmentReason: string
  }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceTask }>(
      `${BACKEND_BASE}/api/tasks/${data.taskId}/applications/${data.applicationId}/appoint`,
      {
        method: 'POST',
        headers: { ...authHeaders(data.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_reason: data.appointmentReason }),
      },
    )
    return body.data
  })

export const submitTaskResult = createServerFn({ method: 'POST' })
  .validator((data: { token: string; taskId: string; body: string }) => data)
  .handler(async ({ data }) => {
    const result = await requestJson<{ data: RiceTask }>(
      `${BACKEND_BASE}/api/tasks/${data.taskId}/submissions`,
      {
        method: 'POST',
        headers: { ...authHeaders(data.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: data.body }),
      },
    )
    return result.data
  })

const reviewTask = async (
  data: { token: string; taskId: string; submissionId: string; reason?: string },
  action: 'approve' | 'request_changes',
) => {
  const body = await requestJson<{ data: RiceTask }>(
    `${BACKEND_BASE}/api/tasks/${data.taskId}/submissions/${data.submissionId}/${action}`,
    {
      method: 'POST',
      headers: { ...authHeaders(data.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: data.reason }),
    },
  )
  return body.data
}

export const approveTaskResult = createServerFn({ method: 'POST' })
  .validator((data: { token: string; taskId: string; submissionId: string }) => data)
  .handler(({ data }) => reviewTask(data, 'approve'))

export const requestTaskChanges = createServerFn({ method: 'POST' })
  .validator((data: {
    token: string
    taskId: string
    submissionId: string
    reason: string
  }) => data)
  .handler(({ data }) => reviewTask(data, 'request_changes'))
