import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestJson } from './http'

afterEach(() => vi.unstubAllGlobals())

describe('HTTP error mapping', () => {
  it('does not expose low-level fetch errors to the interface', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    await expect(requestJson('http://backend.test')).rejects.toThrow(
      '服务暂时不可用，请确认本地服务已经启动。',
    )
  })
})
