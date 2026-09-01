import { Search } from 'lucide-react'

const filters = ['全部', '可领取', '进行中', '我的社区']

export function TasksPage() {
  return (
    <div className="page task-page">
      <section className="task-hero">
        <span>TASKS · COMMUNITY COLLABORATION</span>
        <h1>一起把事情<br />真正做完</h1>
        <p>找任务、申请、协作、记录进度和结算稻米，都在同一条主链路里完成。</p>
        <button type="button" disabled aria-label="我的任务，接口尚未接入">
          我的任务
        </button>
      </section>

      <label className="task-search disabled-control">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">搜索任务</span>
        <input
          disabled
          aria-label="搜索任务，接口尚未接入"
          placeholder="搜索任务标题、描述或标签…"
        />
      </label>

      <div className="task-filters" aria-label="任务筛选">
        {filters.map((filter, index) => (
          <button
            type="button"
            disabled
            className={index === 0 ? 'active' : ''}
            aria-label={`${filter}，接口尚未接入`}
            key={filter}
          >
            {filter}
          </button>
        ))}
      </div>

      <section className="task-summary" aria-label="任务统计">
        <article><strong>—</strong><span>可领取任务</span></article>
        <article><strong>—</strong><span>进行中</span></article>
      </section>

      <section className="task-empty-state" aria-live="polite">
        <strong>暂时没有任务</strong>
        <p>任务接口接入后，真实任务会显示在这里。</p>
      </section>
    </div>
  )
}
