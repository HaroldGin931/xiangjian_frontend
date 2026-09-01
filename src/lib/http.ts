export const BACKEND_BASE =
  process.env.XIANGJIAN_BACKEND_URL ?? 'http://localhost:19006'

export type JsonObject = Record<string, unknown>

const authErrors = new Set([
  'AuthMissing',
  'ExpiredToken',
  'InvalidToken',
  'JwtExpired',
])

export async function readJson(response: Response) {
  const body = (await response.json().catch(() => ({}))) as JsonObject
  if (response.ok) return body

  const errors = body.errors as JsonObject | undefined
  const code = typeof body.error === 'string' ? body.error : ''
  if (response.status === 401 || authErrors.has(code)) {
    throw new Error('登录状态已过期，请重新登录。')
  }

  const detail =
    (typeof errors?.detail === 'string' && errors.detail) ||
    (typeof body.message === 'string' && body.message)
  const fieldError = errors
    ? Object.values(errors).find((value) => Array.isArray(value) && typeof value[0] === 'string')
    : undefined
  throw new Error(
    detail || (Array.isArray(fieldError) ? String(fieldError[0]) : '') ||
      '服务暂时不可用，请稍后重试。',
  )
}

export async function requestJson<T>(
  input: string | URL,
  init?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(input, init)
  } catch {
    throw new Error('服务暂时不可用，请确认本地服务已经启动。')
  }
  return (await readJson(response)) as T
}
