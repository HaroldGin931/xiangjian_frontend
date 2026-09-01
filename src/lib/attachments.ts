export function publicAttachmentUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `http://localhost:19006${path.startsWith('/') ? path : `/${path}`}`
}
