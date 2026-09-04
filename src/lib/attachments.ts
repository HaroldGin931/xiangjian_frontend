export function publicAttachmentUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `/${path.replace(/^\/+/, '')}`
}
