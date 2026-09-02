# 乡建独立前端

面向 Rice 本地链路的独立视觉验收项目。应用使用 TanStack Start 管理路由与服务端接口调用，使用 Astryx 组件与主题作为基础设计层，不依赖 Next.js。

## 本地运行

先启动已有的 Rice 本地栈（默认网关为 `http://localhost:19006`），再运行：

```bash
npx --yes pnpm@10.17.1 install
npm run dev
```

前端默认地址为 `http://127.0.0.1:19007`。如果后端不在默认地址，可通过 `XIANGJIAN_BACKEND_URL` 指定。

## 当前边界

- 已接入：Rice 登录、注册、找回密码、当前用户档案与账号安全、附件头像、Task V1 用户流程；Post Cache 帖子列表与搜索、PDS 文字帖发布、AT Protocol 通知列表。
- 广场只维护一种帖子实体：`#活动` 与 `#商品` 是原帖标签。分类按原帖的完整标签匹配；多个标签会全部展示，特殊标签只切换对应的前端渲染。
- “发布活动”和“发布商品”复用普通帖子接口，并把活动截止时间、地点、参与条件或商品价格、状态、履约说明作为同一帖子里的结构化文本随对应标签发布；活动与商品隐藏转发入口。
- 活动参与复用现有评论接口，写入一条“参与活动”回复。发布帖或评论后先用 PDS 返回的真实记录更新当前页面缓存并立即返回；后续正常读取再由 Post Cache 结果校准，不再阻塞等待索引同步。
- Task V1 前端覆盖发布、申请领取、发布者任命、提交结果、认可结果和“审核未通过并说明理由”；需要与尚待 review 的 Rice Task 分支配套运行。奖励与节点稻米池暂不接入。
- 私信不在当前产品范围内；通知保留为一级入口，并直接读取当前账号的真实通知。
- 项目不预填账号、不生成帖子，页面只展示本地后端返回的真实数据。

## 已知问题

- **公共转发还没有统一的公共 Feed 接口。** 转发记录本身是公开的，但当前 Post Cache 的 `/post/api/posts/list` 只返回顶层 `app.bsky.feed.post`，不会返回 `app.bsky.feed.repost` 对应的 feed event。前端的临时方案是在客户端已有登录会话时，通过 AppView timeline 合并 `reasonRepost`，再按原帖标签执行活动/商品筛选，并在内存中保留完整广场快照；没有发生写操作的页面返回直接复用快照，发布、点赞、转发或评论后才使快照失效或更新。该方案不能让未登录用户看到公共转发；正式修复应由 Post Cache/AppView 提供一次返回原帖和公开转发的统一广场 feed，届时删除前端合并与缓存逻辑。

## 验证

```bash
npm test
npm run build
```

视觉对照结论见 [design-qa.md](./design-qa.md)。

Rice 当前能力、前端接入状态与后续缺口见
[docs/rice-capability-baseline.md](./docs/rice-capability-baseline.md)。

前端复杂度、健康评分与连续优化记录见
[docs/frontend-health.md](./docs/frontend-health.md)。
