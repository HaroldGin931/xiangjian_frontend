import { describe, expect, it } from 'vitest'

import { formatTimestamp } from './format'

describe('timestamp formatting', () => {
  it('uses one explicit timezone for SSR and browser rendering', () => {
    expect(formatTimestamp('2026-09-01T00:00:00.000Z')).toContain('08:00')
  })
})
