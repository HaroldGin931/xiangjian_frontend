export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
export const DEFAULT_IMAGE_MAX_BYTES = 20_000_000

export function imageSizeLabel(bytes: number) {
  return `${Number((bytes / 1_000_000).toFixed(2))} MB`
}

export function validateImageFiles(
  files: ReadonlyArray<Pick<File, 'name' | 'type' | 'size'>>,
  currentCount: number,
  { maxImages = 4, maxBytes = DEFAULT_IMAGE_MAX_BYTES }: { maxImages?: number; maxBytes?: number } = {},
) {
  if (currentCount + files.length > maxImages) return `最多添加 ${maxImages} 张图片。`
  for (const file of files) {
    if (!IMAGE_ACCEPT.split(',').includes(file.type)) return `“${file.name}”格式不支持，请选择 JPEG、PNG、WebP 或 GIF 图片。`
    if (!file.size) return `“${file.name}”是空文件，请重新选择。`
    if (file.size > maxBytes) return `“${file.name}”超过 ${imageSizeLabel(maxBytes)}，请选择较小的图片。`
  }
  return null
}

export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'))
    reader.onabort = () => reject(new Error('图片读取已取消。'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('图片读取失败，请重新选择。'))
      resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

export async function preparePostImage(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) return file
  // Canvas cannot preserve animated GIF frames.
  if (file.type === 'image/gif') throw new Error(`“${file.name}”是 GIF 动图，请缩小到 ${imageSizeLabel(maxBytes)} 以内后添加；其他格式的大图会自动压缩。`)
  if (typeof createImageBitmap !== 'function') throw new Error('当前浏览器无法处理大图，请选择较小的图片或更新浏览器。')
  const image = await createImageBitmap(file).catch(() => { throw new Error(`无法读取“${file.name}”，请重新选择图片。`) })
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理大图，请选择较小的图片。')
    let scale = Math.min(1, 2048 / Math.max(image.width, image.height))
    for (let attempt = 0; attempt < 6; attempt++, scale *= 0.75) {
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp', 0.85))
      if (blob && blob.size <= maxBytes) return new File([blob], file.name, { type: blob.type })
    }
    throw new Error(`“${file.name}”压缩后仍过大，请选择较小的图片。`)
  } finally { image.close() }
}
