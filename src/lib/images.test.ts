import { expect, it } from 'vitest'
import { validateImageFiles } from './images'

it('accepts four supported images at the post size boundary', () => {
  const files = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].map((type) => ({ name: '社区图片', type, size: 2_000_000 }))
  expect(validateImageFiles(files, 0)).toBeNull()
  expect(validateImageFiles([{ ...files[0], size: 2_000_001 }], 0)).toContain('超过 2 MB')
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
