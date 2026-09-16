import { ImageCover } from '~/components/ContentImages'
import { attachmentImages } from '~/lib/attachments'
import { Sprout } from 'lucide-react'
import { useState } from 'react'
import { ContentCardHeader } from '~/components/ContentCardHeader'
import { DetailDialog } from '~/components/DetailDialog'
import { formatTimestamp } from '~/lib/format'
import { TaskDetailPage } from './TaskDetailPage'
import { NodeDetail } from '../nodes/NodesPanel'
import { taskStatusLabel, type RiceTask } from './types'

export function TaskCard({ task, compact = false, onOpen, onOpenCommunity }: { task: RiceTask; compact?: boolean; onOpen?: () => void; onOpenCommunity?: (nodeId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const name = task.node?.name || task.creator.nickname || task.creator.handle
  return <><article className={`content-card task-card business-card ${compact ? 'compact-task-card' : ''}`}>
    {!compact && <ContentCardHeader initial={name.slice(0, 1)} name={name} avatarUrl={task.node ? task.node.logo?.url : task.creator.avatar?.url} onAuthorClick={task.node ? () => onOpenCommunity ? onOpenCommunity(task.node!.id) : setCommunityOpen(true) : undefined} timestamp={`${formatTimestamp(task.published_at ?? task.inserted_at)} · 发布`} />}
    <button type="button" onClick={onOpen ?? (() => setOpen(true))} className="business-card-body">
    <h2>{task.title}</h2>{!compact && <p>{task.description}</p>}
    {!compact && <ImageCover images={attachmentImages(task.attachments)} />}
    <footer className="content-card-actions task-card-actions"><span className={`task-status status-${task.status}`}>{taskStatusLabel[task.status]}</span><strong className="rice-amount" aria-label={`${task.reward_amount} 稻米`}><Sprout size={21} aria-hidden="true" />{task.reward_amount}</strong></footer>
    </button></article>{open && <DetailDialog title="任务详情" onClose={() => setOpen(false)}><TaskDetailPage taskId={task.id} embedded /></DetailDialog>}{communityOpen && task.node && <DetailDialog title="社区详情" onClose={() => setCommunityOpen(false)}><NodeDetail nodeId={task.node.id} /></DetailDialog>}</>
}
