const timestampOptions: Intl.DateTimeFormatOptions = {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
}

const shortTimestamp = new Intl.DateTimeFormat('zh-CN', timestampOptions)
const longTimestamp = new Intl.DateTimeFormat('zh-CN', { ...timestampOptions, year: 'numeric' })

export function formatTimestamp(value: string, includeYear = false) {
  return (includeYear ? longTimestamp : shortTimestamp).format(new Date(value))
}

type AuthorLabel = { handle: string; displayName?: string }

export function authorDisplayName(author: AuthorLabel) {
  return author.displayName || author.handle.split('.')[0]
}
