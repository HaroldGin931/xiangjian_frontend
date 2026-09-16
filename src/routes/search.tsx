import { Avatar } from '~/components/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DetailDialog } from '~/components/DetailDialog'
import { PostCard } from '~/components/PostList'
import { getPostPage } from '~/features/feed/api'
import { PostThreadDialog } from '~/features/feed/PostThreadDialog'
import { postCategory } from '~/features/feed/tags'
import { getEvents, type RiceEvent } from '~/features/events/api'
import { EventCard } from '~/features/events/EventsPage'
import { getNodes, type CommunityNode } from '~/features/nodes/api'
import { NodeCard, NodeDetail } from '~/features/nodes/NodesPanel'
import { useStoredSession } from '~/features/session/session'
import { searchUsers } from '~/features/social/api'
import { UserProfilePage } from '~/features/social/UserProfilePage'
import { getTaskPage } from '~/features/tasks/api'
import { TaskCard } from '~/features/tasks/TaskCard'
import type { RiceTask } from '~/features/tasks/types'
import type { PostView, RicePublicUser } from '~/lib/models'

export const Route = createFileRoute('/search')({ validateSearch: (search: Record<string, unknown>): { q?: string } => typeof search.q === 'string' && search.q.trim() ? { q: search.q.trim() } : {}, component: SearchPage })
function SearchPage() {
  const { q } = Route.useSearch()
  const { session } = useStoredSession()
  const [query, setQuery] = useState(q ?? '')
  const [searched, setSearched] = useState('')
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [posts, setPosts] = useState<PostView[]>([])
  const [events, setEvents] = useState<RiceEvent[]>([])
  const [nodes, setNodes] = useState<CommunityNode[]>([])
  const [users, setUsers] = useState<RicePublicUser[]>([])
  const [cursors, setCursors] = useState<{ tasks?: string; posts?: string; events?: string; users?: string }>({})
  const [failedGroups, setFailedGroups] = useState<string[]>([])
  const [selectedPost, setSelectedPost] = useState<PostView | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const version = useRef(0)
  const search = async (value = query) => {
    value = value.trim(); if (!value) return
    const current = ++version.current
    setLoading(true); setError(''); setSearched(value); setTasks([]); setPosts([]); setEvents([]); setNodes([]); setUsers([]); setCursors({}); setFailedGroups([])
    const result = await Promise.allSettled([
      getTaskPage({ data: { q: value, token: session?.token, limit: 10 } }),
      getPostPage({ data: { query: value, accessJwt: session?.pds.access_jwt, did: session?.pds.did, limit: 10, category: 'post' } }),
      getEvents({ data: { q: value, token: session?.token } }),
      getNodes({ data: { q: value, token: session?.token } }),
      searchUsers({ data: { q: value } }),
    ])
    if (current !== version.current) return
    const [t, p, e, n, u] = result
    if (t.status === 'fulfilled') setTasks(t.value.data)
    if (p.status === 'fulfilled') setPosts(p.value.posts)
    if (e.status === 'fulfilled') setEvents(e.value.data)
    if (n.status === 'fulfilled') setNodes(n.value)
    if (u.status === 'fulfilled') setUsers(u.value.data)
    setCursors({ tasks: t.status === 'fulfilled' ? t.value.meta.next_cursor ?? undefined : undefined, posts: p.status === 'fulfilled' ? p.value.cursor ?? undefined : undefined, events: e.status === 'fulfilled' ? e.value.meta?.next_cursor ?? undefined : undefined, users: u.status === 'fulfilled' ? u.value.meta.next_cursor ?? undefined : undefined })
    setFailedGroups(['任务', '帖子', '活动', '社区', '用户'].filter((_, index) => result[index].status === 'rejected'))
    if (result.some((r) => r.status === 'rejected')) setError('部分搜索结果暂时无法加载，请重试。')
    setLoading(false)
  }
  useEffect(() => { if (q) { setQuery(q); void search(q) } }, [q])
  const more = async (kind: 'tasks' | 'posts' | 'events' | 'users') => {
    if (!cursors[kind] || loading) return
    const current = version.current; setLoading(true); setError('')
    try {
      if (kind === 'tasks') { const page = await getTaskPage({ data: { q: searched, token: session?.token, before: cursors.tasks, limit: 10 } }); if (current === version.current) { setTasks((r) => [...r, ...page.data]); setCursors((c) => ({ ...c, tasks: page.meta.next_cursor ?? undefined })) } }
      else if (kind === 'events') { const page = await getEvents({ data: { q: searched, token: session?.token, before: cursors.events } }); if (current === version.current) { setEvents((r) => [...r, ...page.data]); setCursors((c) => ({ ...c, events: page.meta?.next_cursor ?? undefined })) } }
      else if (kind === 'users') { const page = await searchUsers({ data: { q: searched, before: cursors.users } }); if (current === version.current) { setUsers((r) => [...r, ...page.data]); setCursors((c) => ({ ...c, users: page.meta.next_cursor ?? undefined })) } }
      else { const page = await getPostPage({ data: { query: searched, accessJwt: session?.pds.access_jwt, did: session?.pds.did, cursor: cursors.posts, limit: 10, category: 'post' } }); if (current === version.current) { setPosts((r) => [...r, ...page.posts]); setCursors((c) => ({ ...c, posts: page.cursor ?? undefined })) } }
    } catch (e) { if (current === version.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === version.current) setLoading(false) }
  }
  const emptyMessage = (title: string) => failedGroups.includes(title) ? '暂时无法加载，请重试。' : loading ? '正在搜索…' : `没有相关${title}`
  return <div className="page search-page"><header className="standalone-header"><Link to="/" className="back-link" aria-label="返回广场"><ArrowLeft size={20} /></Link><div className="global-search-field"><TextInput label="搜索帖子、任务、活动、社区、用户" isLabelHidden placeholder="搜索帖子、任务、活动、社区、用户" value={query} onChange={setQuery} onEnter={() => void search()} width="100%" hasClear /><Button label="搜索" variant="primary" isDisabled={!query.trim() || loading} clickAction={() => search()} /></div></header>
    {error && <p className="inline-error" role="alert">{error}</p>}{loading && <p className="loading-line">正在搜索…</p>}
    {!searched ? <p className="search-hint">输入关键词，搜索帖子、任务、活动、社区、用户。</p> : <div key={searched}>
      <SearchGroup title="帖子" count={posts.length} hasMore={!!cursors.posts} emptyMessage={emptyMessage('帖子')}>
        <div className="post-list">{posts.map((post) => <PostCard post={post} key={post.uri} onOpenPost={() => setSelectedPost(post)} />)}</div>
        {cursors.posts && <Button label="更多帖子" variant="ghost" isDisabled={loading} clickAction={() => more('posts')} />}
      </SearchGroup>
      <SearchGroup title="任务" count={tasks.length} hasMore={!!cursors.tasks} emptyMessage={emptyMessage('任务')}>
        <div className="task-list">{tasks.map((task) => <TaskCard task={task} key={task.id} />)}</div>
        {cursors.tasks && <Button label="更多任务" variant="ghost" isDisabled={loading} clickAction={() => more('tasks')} />}
      </SearchGroup>
      <SearchGroup title="活动" count={events.length} hasMore={!!cursors.events} emptyMessage={emptyMessage('活动')}>
        <div className="task-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div>
        {cursors.events && <Button label="更多活动" variant="ghost" isDisabled={loading} clickAction={() => more('events')} />}
      </SearchGroup>
      <SearchGroup title="社区" count={nodes.length} emptyMessage={emptyMessage('社区')}>
        <div className="node-list">{nodes.map((node) => <NodeCard node={node} onOpen={() => setSelectedNode(node.id)} key={node.id} />)}</div>
      </SearchGroup>
      <SearchGroup title="用户" count={users.length} hasMore={!!cursors.users} emptyMessage={emptyMessage('用户')}>
        <div className="people-list">{users.map((user) => <button type="button" onClick={() => setSelectedUser(user.did)} className="person-row search-person-row" key={user.id}>
          <Avatar name={user.nickname || user.handle} src={user.avatar?.url} />
          <span className="person-copy"><strong>{user.nickname || user.handle}</strong><small>@{user.handle}</small>{user.bio && <p>{user.bio}</p>}</span>
        </button>)}</div>
        {cursors.users && <Button label="更多用户" variant="ghost" isDisabled={loading} clickAction={() => more('users')} />}
      </SearchGroup>
    </div>}
    {selectedPost && <PostThreadDialog uri={selectedPost.uri} category={postCategory(selectedPost.record)} focusReply={false} onClose={() => setSelectedPost(null)} />}{selectedNode && <DetailDialog title="社区详情" onClose={() => setSelectedNode(null)}><NodeDetail nodeId={selectedNode} /></DetailDialog>}
    {selectedUser && <DetailDialog title="个人主页" onClose={() => setSelectedUser(null)}><UserProfilePage actor={selectedUser} embedded /></DetailDialog>}
  </div>
}

function SearchGroup({ title, count, hasMore, emptyMessage, children }: { title: string; count: number; hasMore?: boolean; emptyMessage: string; children: ReactNode }) {
  return <details className="business-section search-result-group" open>
    <summary><h2>{title} · {count}{hasMore ? '+' : ''}</h2><span className="search-group-toggle"><span className="search-group-collapse">收起</span><span className="search-group-expand">展开</span><ChevronDown size={18} aria-hidden="true" /></span></summary>
    {count ? children : <p className="search-group-empty">{emptyMessage}</p>}
  </details>
}
