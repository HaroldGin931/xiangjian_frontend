import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DateTimeField } from './DateTimeField'

it('offers only quarter-hours and disables values outside the linked time range', () => {
  const html = renderToStaticMarkup(<DateTimeField label="开始时间" value="2026-10-01T10:15" min="2026-10-01T10:15" max="2026-10-01T11:00" onChange={() => undefined} />)
  const options = [...html.matchAll(/<option([^>]*)value="(\d\d:\d\d)"([^>]*)>/g)]
  expect(options).toHaveLength(96)
  expect(options.every(match => /:(00|15|30|45)$/.test(match[2]))).toBe(true)
  expect(options.filter(match => !`${match[1]}${match[3]}`.includes('disabled')).map(match => match[2])).toEqual(['10:15', '10:30', '10:45', '11:00'])
  expect(html).toContain('开始时间日期（北京时间）')
})
