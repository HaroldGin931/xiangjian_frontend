export type PostKind = 'post' | 'activity' | 'product'

export const ACTIVITY_PARTICIPATION_TEXT = '参与活动'

type PostField = {
  key: string
  label: string
  type: 'text' | 'datetime-local' | 'number' | 'select'
  placeholder?: string
  options?: readonly string[]
}

export const POST_KINDS = {
  post: {
    tag: null,
    placeholder: '说点什么…',
    publishLabel: '发布内容',
    fields: [],
  },
  activity: {
    tag: '#活动',
    placeholder: '介绍活动内容、时间和地点…',
    publishLabel: '发布活动',
    fields: [
      { key: 'deadline', label: '截止时间', type: 'datetime-local' },
      { key: 'location', label: '活动地点', type: 'text', placeholder: '填写集合或活动地点' },
      { key: 'conditions', label: '参与条件', type: 'text', placeholder: '填写参与要求或准备事项' },
    ] satisfies readonly PostField[],
  },
  product: {
    tag: '#商品',
    placeholder: '介绍商品、价格和履约方式…',
    publishLabel: '发布商品',
    fields: [
      { key: 'price', label: '参考稻米', type: 'number', placeholder: '填写数量' },
      {
        key: 'availability',
        label: '可用状态',
        type: 'select',
        options: ['可提供', '接受预订', '暂不可用'],
      },
      { key: 'fulfillment', label: '履约说明', type: 'text', placeholder: '填写自提、配送或确认方式' },
    ] satisfies readonly PostField[],
  },
} as const

export function postTags(text: string) {
  return [...new Set(text.match(/#[\p{L}\p{N}_-]+/gu) ?? [])]
}

export function hasPostTag(text: string, tag: string) {
  const expected = (tag.startsWith('#') ? tag : `#${tag}`).toLocaleLowerCase()
  return postTags(text).some((value) => value.toLocaleLowerCase() === expected)
}

export function postKind(text: string): PostKind {
  const specialTag = postTags(text).find((tag) => tag === '#活动' || tag === '#商品')
  return specialTag === '#活动' ? 'activity' : specialTag === '#商品' ? 'product' : 'post'
}

export function postFieldValues(text: string, kind = postKind(text)) {
  const values: Record<string, string> = {}
  for (const field of POST_KINDS[kind].fields) {
    const prefix = `${field.label}：`
    const line = text.split('\n').find((value) => value.startsWith(prefix))
    if (line) values[field.key] = line.slice(prefix.length).trim()
  }
  return values
}

export function postDisplayText(text: string) {
  const fields = POST_KINDS[postKind(text)].fields
  return text
    .split('\n')
    .filter((line) => !fields.some((field) => line.startsWith(`${field.label}：`)))
    .filter((line) => !/^\s*(?:#[\p{L}\p{N}_-]+\s*)+$/u.test(line))
    .join('\n')
    .trim()
}

export function formatPostFieldValue(key: string, value?: string) {
  if (!value) return '—'
  return key === 'deadline' ? value.replace('T', ' ') : value
}

export function withPostKind(
  text: string,
  kind: PostKind,
  values: Record<string, string> = {},
) {
  const body = text.trim()
  const details = POST_KINDS[kind]
  const metadata = details.fields.flatMap((field) => {
    const value = values[field.key]?.trim()
    return value ? [`${field.label}：${value}`] : []
  })
  const tag = details.tag && !hasPostTag(body, details.tag) ? details.tag : null
  return [body, ...metadata, tag].filter(Boolean).join('\n')
}
