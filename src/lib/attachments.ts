import { BACKEND_BASE } from './http'

export function publicAttachmentUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${BACKEND_BASE}${path.startsWith('/') ? path : `/${path}`}`
}
