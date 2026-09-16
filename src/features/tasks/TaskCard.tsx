import { ImageCover } from '~/components/ContentImages'
import { attachmentImages } from '~/lib/attachments'
import { Sprout } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useDetailPrefetch } from '~/components/useDetailPrefetch'
import { useStoredSession } from '../session/session'
import { getTask } from './api'
import { ContentCardHeader } from '~/components/ContentCardHeader'
import { DetailDialog } from '~/components/DetailDialog'
import { formatTimestamp } from '~/lib/format'
import { TaskDetailPage } from './TaskDetailPage'
import { NodeDetail } from '../nodes/NodesPanel'
import { taskStatusLabel, type RiceTask } from './types'

export function TaskCard({ task, compact = false, onOpen, onOpenCommunity }: { task: RiceTask; compact?: boolean; onOpen?: (load: (token?: string) => Promise<RiceTask>) => void; onOpenCommunity?: (nodeId: string) => void }) {
  const { session } = useStoredSession()
  const loadTask = useDetailPrefetch(useCallback(() => getTask({ data: { id: task.id, token: session?.token } }), [task.id, session?.token]))
  const prefetch = () => { void loadTask().catch(() => undefined) }
  const [open, setOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const name = task.node?.name || task.creator.nickname || task.creator.handle
  return <><article className={`content-card task-card business-card ${compact ? 'compact-task-card' : ''}`}>
    {!compact && <ContentCardHeader name={name} avatarUrl={task.node ? task.node.logo?.url : task.creator.avatar?.url} onAuthorClick={task.node ? () => onOpenCommunity ? onOpenCommunity(task.node!.id) : setCommunityOpen(true) : undefined} timestamp={`${formatTimestamp(task.published_at ?? task.inserted_at)} · 发布`} />}
    <button type="button" onPointerEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch} onClick={() => { prefetch(); if (onOpen) onOpen((token) => token === session?.token ? loadTask() : getTask({ data: { id: task.id, token } })); else setOpen(true) }} className="business-card-body">
    <h2>{task.title}</h2>{!compact && <p>{task.description}</p>}
    {!compact && <ImageCover images={attachmentImages(task.attachments)} />}
    <footer className="content-card-actions task-card-actions"><span className={`task-status status-${task.status}`}>{taskStatusLabel[task.status]}</span><strong className="rice-amount" aria-label={`${task.reward_amount} 稻米`}><Sprout size={21} aria-hidden="true" />{task.reward_amount}</strong></footer>
    </button></article>{open && <DetailDialog title="任务详情" onClose={() => setOpen(false)}><TaskDetailPage taskId={task.id} loadTask={(token) => token === session?.token ? loadTask() : getTask({ data: { id: task.id, token } })} embedded /></DetailDialog>}{communityOpen && task.node && <DetailDialog title="社区详情" onClose={() => setCommunityOpen(false)}><NodeDetail nodeId={task.node.id} /></DetailDialog>}</>
}
