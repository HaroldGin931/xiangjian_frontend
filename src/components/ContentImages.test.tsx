import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ImageCover, ImageGroup } from './ContentImages'

it('lays out one to nine images without dropping any', () => {
  for (const [count, columns] of [[1, 1], [4, 2], [9, 3]]) {
    const images = Array.from({ length: count }, (_, index) => ({ src: `/image-${index}.jpg`, alt: `图片 ${index + 1}` }))
    const html = renderToStaticMarkup(<ImageGroup images={images} onOpen={() => {}} />)
    expect(html).toContain('post-image-grid')
    expect(html).toContain(`repeat(${columns}, 1fr)`)
    expect(html.match(/<img\b/g)).toHaveLength(count)
  }

  const single = renderToStaticMarkup(<ImageCover images={[{ src: '/one.jpg', alt: '图片' }]} />)
  expect(single).toContain('content-image-cover')
  expect(single.match(/<img\b/g)).toHaveLength(1)
  expect(single).not.toContain('content-image-count')
})
