import { Badge } from '@astryxdesign/core/Badge'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/interfaces')({
  component: InterfacesPage,
})

const rows = [
  ['登录 Rice', 'POST /api/session', '已接入'],
  ['当前用户', 'GET /api/users/me', '已接入'],
  ['广场帖子', 'POST /post/api/posts', '已接入'],
  ['搜索帖子', 'POST /post/api/posts/search', '已接入'],
  ['发布文字帖', 'POST /pds/xrpc/com.atproto.repo.createRecord', '已接入'],
  ['任务列表', 'Rice Task API', '等待后端'],
  ['任务发布 / 领取 / 验收 / 拒绝', 'Rice Task API', '等待后端'],
] as const

function InterfacesPage() {
  return (
    <div className="page">
      <section className="page-intro">
        <div className="eyebrow">实现边界</div>
        <h1>接口台账</h1>
        <p>这张表只描述当前代码已经调用的真实接口，以及明确等待后端的灰态能力。</p>
      </section>

      <section className="ledger-table" aria-label="接口接入状态">
        <div className="ledger-row ledger-header">
          <span>前端能力</span><span>调用依据</span><span>状态</span>
        </div>
        {rows.map(([name, endpoint, status]) => (
          <div className={`ledger-row ${status === '等待后端' ? 'pending-row' : ''}`} key={name}>
            <strong>{name}</strong>
            <code>{endpoint}</code>
            <Badge variant={status === '已接入' ? 'success' : 'neutral'} label={status} />
          </div>
        ))}
      </section>
    </div>
  )
}

