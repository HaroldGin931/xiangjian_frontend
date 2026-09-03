import type { PostCategory, PostView } from '~/lib/models'

export const ACTIVITY_PARTICIPATION_TEXT = '参与活动'

type PostField = {
  key: string
  label: string
  type: 'text' | 'datetime-local' | 'number' | 'select'
  placeholder?: string
  options?: readonly string[]
}

export const POST_CATEGORIES = {
  post: {
    label: '帖子',
    placeholder: '说点什么…',
    publishLabel: '发布内容',
    fields: [],
  },
  activity: {
    label: '活动',
    placeholder: '介绍活动内容、时间和地点…',
    publishLabel: '发布活动',
    fields: [
      { key: 'deadline', label: '截止时间', type: 'datetime-local' },
      { key: 'location', label: '活动地点', type: 'text', placeholder: '填写集合或活动地点' },
      { key: 'conditions', label: '参与条件', type: 'text', placeholder: '填写参与要求或准备事项' },
    ] satisfies readonly PostField[],
  },
  product: {
    label: '商品',
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

export function postCategory(record: PostView['record']): PostCategory {
  return record.xjdaoCategory === 'activity' || record.xjdaoCategory === 'product'
    ? record.xjdaoCategory
    : 'post'
}

export function postFieldValues(text: string, category: PostCategory) {
  const values: Record<string, string> = {}
  for (const field of POST_CATEGORIES[category].fields) {
    const prefix = `${field.label}：`
    const line = text.split('\n').find((value) => value.startsWith(prefix))
    if (line) values[field.key] = line.slice(prefix.length).trim()
  }
  return values
}

export function postDisplayText(text: string, category: PostCategory) {
  const fields = POST_CATEGORIES[category].fields
  return text
    .split('\n')
    .filter((line) => !fields.some((field) => line.startsWith(`${field.label}：`)))
    .join('\n')
    .trim()
}

export function formatPostFieldValue(key: string, value?: string) {
  if (!value) return '—'
  return key === 'deadline' ? value.replace('T', ' ') : value
}

export function withPostCategory(
  text: string,
  category: PostCategory,
  values: Record<string, string> = {},
) {
  const body = text.trim()
  const details = POST_CATEGORIES[category]
  const metadata = details.fields.flatMap((field) => {
    const value = values[field.key]?.trim()
    return value ? [`${field.label}：${value}`] : []
  })
  return [body, ...metadata].filter(Boolean).join('\n')
}

export function postTextParts(text: string) {
  return text
    .split(/(#[\p{L}\p{N}_-]+)/gu)
    .filter(Boolean)
    .map((value) => ({ value, isTag: /^#[\p{L}\p{N}_-]+$/u.test(value) }))
}
