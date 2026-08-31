import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute } from '@tanstack/react-router'
import { BadgeInfo, ListTodo } from 'lucide-react'

export const Route = createFileRoute('/tasks')({ component: TasksPage })

function TasksPage() {
  return (
    <div className="page">
      <section className="page-intro intro-with-action">
        <div>
          <div className="eyebrow">独立业务入口</div>
          <h1>任务</h1>
          <p>第一版只完成视觉与状态边界；Rice 尚未提供的 Task API 不在前端伪造。</p>
        </div>
        <div className="primary-action-block">
          <Button label="发布任务" variant="primary" size="lg" isDisabled />
          <span>等待 Rice Task API</span>
        </div>
      </section>

      <section className="task-stats" aria-label="任务统计">
        <div><span>可领取</span><strong>—</strong></div>
        <div><span>进行中</span><strong>—</strong></div>
        <div><span>待验收</span><strong>—</strong></div>
        <div><span>已完成</span><strong>—</strong></div>
      </section>

      <section className="info-strip muted-strip">
        <BadgeInfo size={30} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <strong>这里没有任务 mock 数据</strong>
          <p>发布、领取、验收、拒绝会等后端接口确认后逐个开放，当前全部标灰。</p>
        </div>
      </section>

      <section className="task-toolbar">
        <TextInput
          label="搜索任务"
          value=""
          isDisabled
          disabledMessage="Rice 尚未提供 Task 查询接口"
          placeholder="等待 Task 查询接口"
          width="100%"
        />
        <div className="disabled-filters">
          <Button label="全部" isDisabled />
          <Button label="可领取" isDisabled />
          <Button label="进行中" isDisabled />
        </div>
      </section>

      <div className="empty-panel task-empty">
        <EmptyState
          icon={<ListTodo size={34} />}
          title="任务接口尚未接入"
          description="验收视觉后，再在 Rice 中实现 Task 表与最小状态机。"
        />
      </div>
    </div>
  )
}
