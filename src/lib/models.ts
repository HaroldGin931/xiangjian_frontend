export type RiceUser = {
  id: string
  did: string
  handle: string
  nickname: string | null
  bio: string | null
  avatar: null | {
    id: string
    kind: string
    filename: string
    content_type: string
    byte_size: number
    url: string
  }
  grain_balance: number
  node_member: boolean
  email: string | null
  phone: string | null
  phone_region: string | null
  wallet_address: string | null
  inserted_at: string
}

export type RiceSession = {
  token: string
  user: RiceUser
  pds: {
    service: string
    did: string
    handle: string
    access_jwt: string
    refresh_jwt: string
  }
}

export type PostView = {
  uri: string
  cid: string
  indexedAt: string
  author: {
    did: string
    handle: string
    displayName?: string
  }
  record: {
    text: string
    createdAt: string
    langs?: string[]
  }
  replyCount: number
  repostCount: number
  likeCount: number
  viewer?: {
    like?: string
    repost?: string
    bookmarked?: boolean
    threadMuted?: boolean
    embeddingDisabled?: boolean
  }
}

export type PostFeed = {
  posts: PostView[]
  total: number
}

export type PostThread = {
  post: PostView
  replies: PostThread[]
}

export type NotificationView = {
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
  }
  reason: string
  reasonSubject?: string
  text: string
  isRead: boolean
  indexedAt: string
}

export type NotificationFeed = {
  notifications: NotificationView[]
  priority: boolean
  seenAt?: string
}
