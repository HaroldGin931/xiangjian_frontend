const shortTimestamp = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

const longTimestamp = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

export function formatTimestamp(value: string, includeYear = false) {
  return (includeYear ? longTimestamp : shortTimestamp).format(new Date(value))
}

export function localDateTimeValue(value: Date | string = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

type AuthorLabel = { handle: string; displayName?: string }

export function authorDisplayName(author: AuthorLabel) {
  return author.displayName || author.handle.split('.')[0]
}
