import { beijingDateTimeValue } from './date-time'

export function formatTimestamp(value: string, _includeYear = false) {
  return beijingDateTimeValue(value).replace('T', ' ')
}

type AuthorLabel = { handle: string; displayName?: string }

export function authorDisplayName(author: AuthorLabel) {
  return author.displayName || author.handle.split('.')[0]
}
