export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
// All publishing forms use the smallest supported limit (the PDS image lexicon).
export const DEFAULT_IMAGE_MAX_BYTES = 1_000_000

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
