export type PostKind = 'post' | 'activity' | 'product'

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
    fields: ['活动时间', '活动地点', '参与说明'],
  },
  product: {
    tag: '#商品',
    placeholder: '介绍商品、价格和履约方式…',
    publishLabel: '发布商品',
    fields: ['参考稻米', '可用状态', '履约说明'],
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

export function withPostKind(text: string, kind: PostKind) {
  const body = text.trim()
  const tag = POST_KINDS[kind].tag
  return tag && !hasPostTag(body, tag) ? `${body}\n${tag}` : body
}
