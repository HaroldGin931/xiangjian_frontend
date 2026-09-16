import { describe, expect, it } from 'vitest'

import { authorDisplayName, formatTimestamp } from './format'

describe('timestamp formatting', () => {
  it('uses one explicit timezone for SSR and browser rendering', () => {
    expect(formatTimestamp('2026-09-01T00:00:00.000Z')).toContain('08:00')
  })
})

describe('author formatting', () => {
  it('prefers a display name and otherwise shortens the handle', () => {
    expect(authorDisplayName({ handle: 'mo-alice.local', displayName: 'Alice' }))
      .toBe('Alice')
    expect(authorDisplayName({ handle: 'mo-bob.local' })).toBe('mo-bob')
  })
})
