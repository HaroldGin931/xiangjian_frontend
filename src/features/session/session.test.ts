import { describe, expect, it } from 'vitest'

import { tokenExpiresSoon } from './session'

function jwt(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `header.${payload}.signature`
}

describe('PDS session lifetime', () => {
  it('refreshes only tokens that are expired or about to expire', () => {
    const now = Date.UTC(2026, 8, 1)
    expect(tokenExpiresSoon(jwt(now / 1000 + 30), now)).toBe(true)
    expect(tokenExpiresSoon(jwt(now / 1000 + 120), now)).toBe(false)
  })
})
