import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute } from '@tanstack/react-router'
import { ListTodo } from 'lucide-react'

export const Route = createFileRoute('/tasks')({ component: TasksPage })

function TasksPage() {
  return (
    <div className="page">
      <section className="page-intro intro-with-action">
        <div>
          <div className="eyebrow">共建机会</div>
          <h1>任务</h1>
          <p>浏览社区中的共建任务，找到适合你的参与方式。</p>
        </div>
        <div className="primary-action-block">
          <Button label="发布任务" variant="primary" size="lg" isDisabled />
        </div>
      </section>

      <section className="task-stats" aria-label="任务统计">
        <div><span>可领取</span><strong>—</strong></div>
        <div><span>进行中</span><strong>—</strong></div>
        <div><span>待验收</span><strong>—</strong></div>
        <div><span>已完成</span><strong>—</strong></div>
      </section>

      <section className="task-toolbar">
        <TextInput
          label="搜索任务"
          value=""
          isDisabled
          placeholder="搜索任务"
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
          title="暂时没有任务"
          description="新的共建任务会显示在这里。"
        />
      </div>
    </div>
  )
}
