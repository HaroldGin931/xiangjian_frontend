import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_IMAGE_MAX_BYTES, preparePostImage, validateImageFiles } from './images'
import { MAX_POST_IMAGE_BYTES } from './pds'

afterEach(() => vi.unstubAllGlobals())

it('accepts larger source images consistently while keeping the PDS upload boundary', () => {
  expect(DEFAULT_IMAGE_MAX_BYTES).toBe(20_000_000)
  expect(MAX_POST_IMAGE_BYTES).toBe(1_000_000)
  const files = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].map((type) => ({ name: '社区图片', type, size: DEFAULT_IMAGE_MAX_BYTES }))
  expect(validateImageFiles(files, 0)).toBeNull()
  expect(validateImageFiles([{ ...files[0], size: DEFAULT_IMAGE_MAX_BYTES + 1 }], 0)).toContain('超过 20 MB')
})

it('compresses large static images to the upload boundary without silently flattening GIFs', async () => {
  const small = new File(['small'], 'small.gif', { type: 'image/gif' })
  await expect(preparePostImage(small, MAX_POST_IMAGE_BYTES)).resolves.toBe(small)
  const large = new File([new Uint8Array(2_000_000)], 'large.png', { type: 'image/png' })
  const bitmap = { width: 4000, height: 3000, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
  const drawImage = vi.fn()
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: vi.fn(callback => callback(new Blob([new Uint8Array(900_000)], { type: 'image/webp' }))) }
  vi.stubGlobal('document', { createElement: () => canvas })
  const prepared = await preparePostImage(large, MAX_POST_IMAGE_BYTES)
  expect(prepared.size).toBeLessThanOrEqual(MAX_POST_IMAGE_BYTES)
  expect(prepared.type).toBe('image/webp')
  expect([canvas.width, canvas.height]).toEqual([2048, 1536])
  expect(bitmap.close).toHaveBeenCalledOnce()
  await expect(preparePostImage(new File([large], 'animated.gif', { type: 'image/gif' }), MAX_POST_IMAGE_BYTES)).rejects.toThrow('GIF 动图')
})

it('counts existing images and applies the supplied upload limit', () => {
  const file = { name: '工作坊.png', type: 'image/png', size: 3_000_000 }
  expect(validateImageFiles([file], 3, { maxBytes: 5_000_000 })).toBeNull()
  expect(validateImageFiles([file], 4, { maxBytes: 5_000_000 })).toContain('最多添加 4 张')
})

it('rejects empty files and files outside supported image formats', () => {
  expect(validateImageFiles([{ name: '空图.png', type: 'image/png', size: 0 }], 0)).toContain('空文件')
  expect(validateImageFiles([{ name: '文档.svg', type: 'image/svg+xml', size: 100 }], 0)).toContain('格式不支持')
})
