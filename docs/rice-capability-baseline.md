# Rice 能力基线与后续缺口

这份文档回答两个问题：

1. **Rice 当前实际提供了什么，我们现在怎样使用它。**
2. **产品后续需要、但 Rice 当前还没有提供什么。**

它不是 Rice 接口文档的副本。请求字段、响应示例和错误码仍以 Rice 自己的
`docs/api` 为准；这里负责记录前端与 Rice 之间的能力边界和接入状态。

## 核对基线

| 项目 | 本次核对结果 |
| --- | --- |
| Rice 仓库 | `HaroldGin931/rice`（上游：`xjdao2025/rice`） |
| 分支与基线提交 | `feat/task-v1`，从 `b0d3da515b6a750d297d8178ce21a274d82d6415` 开始实现 |
| Git 状态 | Task V1 已按账号与任务边界拆分为本地提交，尚未推送 |
| 实现依据 | `lib/rice_web/router.ex`、对应 controller / JSON view |
| 文档依据 | `docs/api/README.md` 与各 controller 文档 |
| 前端依据 | 本仓库 `src/features/**/api.ts` 及调用页面 |
| 运行核验 | 2026-09-01，本地 Docker 中 Rice、PDS、AppView、Post Cache、网关与前端均在运行 |

运行核验确认了：

- `POST /api/session` 返回 Rice `token`、完整 `user` 和独立的 PDS 会话。
- `GET /api/users/me` 的字段与当前前端 `RiceUser` 类型一致，包括
  `wallet_address`。
- `/api/apps`、`/api/banners`、`/api/announcements`、
  `/api/settings/foundation`、`/api/nodes`、`/api/nodes/members`、
  `/api/grain_grants`、`/api/proposals` 在当前运行环境均返回 `200`。

这次运行核验确认的是当前容器的可达性和响应形状；Git 提交是源代码审计基线，
容器镜像本身没有写入 Git commit 元数据，因此不能仅凭镜像摘要证明二者逐字相同。

本次还发现一处 Rice 文档遗漏：`docs/api/user_controller.md` 的用户对象示例没有列出
`wallet_address`，但 `UserJSON.data/1`、登录响应、`GET /api/users/me` 和当前前端类型
都包含该字段。当前应以实现与运行响应为准，并在后续修改 Rice 时补回它自己的接口
文档。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已接入 | Rice 有实现，当前前端已有真实调用 |
| Rice 就绪 | Rice 有路由、实现和文档，但当前前端尚未调用 |
| Rice 不足 | Rice 只有部分基础能力，仍不足以完成对应产品流程 |
| 非 Rice | 产品已经使用或需要该能力，但权威服务不应是 Rice |

## 第一块：Rice 当前提供什么，我们如何使用

### 1. 当前前端直接使用的 Rice 接口

| 接口 | 当前用法 | 前端调用点 | 状态 | Rice 文档 |
| --- | --- | --- | --- | --- |
| `POST /api/session` | 用账号和密码登录；一次取得 Rice token、用户档案和 PDS session | `src/features/session/api.ts` → 登录页 | 已接入 | `docs/api/session_controller.md` |
| `DELETE /api/session` | 退出时撤销当前 Rice token；前端随后清除本地会话 | `src/features/session/api.ts` → 个人中心 | 已接入 | `docs/api/session_controller.md` |
| 注册与找回密码 4 个接口 | 验证手机号/邮箱后注册；通过已登记联系方式重置 PDS 密码 | `src/features/account/api.ts` → 注册页、找回密码页 | 已接入 | `verification_code_controller.md`、`registration_controller.md`、`password_controller.md` |
| `GET/PATCH/DELETE /api/users/me` | 会话启动时刷新权限与档案；编辑昵称、简介、头像；注销账号 | `src/features/session/api.ts`、`src/features/account/api.ts` → 我的、资料、账号页 | 已接入 | `docs/api/user_controller.md` |
| `PUT /api/users/me/phone`、`PUT /api/users/me/email` | 验证新联系方式后改绑 | `src/features/account/api.ts` → 账号与安全 | 已接入 | `docs/api/user_controller.md` |
| `POST/GET /api/attachments` | 上传 Rice 头像并通过公开附件地址显示 | `src/features/account/api.ts`、`src/lib/attachments.ts` → 编辑资料 | 已接入 | `docs/api/attachment_controller.md` |
| Task V1 任务接口 | 列表/详情、发布、申请、任命、提交结果、审核通过、驳回并留言 | `src/features/tasks/api.ts` → 任务、任务详情、我的任务 | 已接入 | `docs/api/task_controller.md` |

当前登录后，前端保存的是两套互不替代的凭据：

- `session.token`：只用于 Rice `/api/*`。
- `session.pds.access_jwt` / `refresh_jwt`：用于 PDS / AT Protocol。

Rice 不保存 PDS 密码，也不代管 PDS session。前端不得拿其中一种 token 调用另一套
接口。

### 2. Rice 已提供、但当前前端尚未接入的 C 端能力

下面按产品能力归组；“Rice 就绪”表示后续只需做前端接入，不应再要求后端重复实现。

| 能力 | Rice 已有接口 | 当前前端状态 | 结论 | Rice 文档 |
| --- | --- | --- | --- | --- |
| 首页运营内容 | `GET /api/apps`；`GET /api/banners`；`GET /api/announcements`；`GET /api/announcements/:id`；`GET /api/settings/foundation` | 独立前端尚未展示 | Rice 就绪 | `app_controller.md`、`banner_controller.md`、`announcement_controller.md`、`settings_controller.md` |
| 节点与勋章 | `GET /api/nodes`；`GET /api/nodes/members`；`GET /api/users/:user_id/badges` | 个人中心只使用 `user.node_member` 布尔值；“我的社区”仍标灰 | 基础读取已就绪，但“我的社区”是否等同节点仍需产品确认 | `node_controller.md`、`badge_controller.md` |
| 稻米 | `GET /api/grain_grants`；`GET/POST /api/grain_transfers` | 只展示 `GET /api/users/me` 返回的 `grain_balance`；“查看流水”仍标灰 | 流水和转账均已就绪，不需要新增后端 | `grain_grant_controller.md`、`grain_transfer_controller.md` |
| 提案与治理 | `GET/POST /api/proposals`；`GET/DELETE /api/proposals/:id`；`GET/POST /api/proposals/:proposal_id/vote`；`GET/POST/DELETE /api/proposals/:proposal_id/comments[/:id]` | “联盟与治理”仍标灰 | 列表、详情、发起、删除、投票和评论均已就绪 | `proposal_controller.md`、`proposal_vote_controller.md`、`proposal_comment_controller.md` |

Rice 的共同约定已经完整记录在 `docs/api/README.md`：成功响应使用 `data`，列表另有
`meta`，认证使用 `Authorization: Bearer <token>`，错误使用 HTTP 状态码和
`{"errors": ...}`。本仓库不再复制这些字段级说明。

### 3. Rice 还提供、但不属于当前用户前端的接口

- 浏览器 OAuth / 会话交接：`GET /login`、`GET /callback`、`GET /logout`、
  `GET /session/:ticket`，另有调试落地页 `GET /`。
- 管理端：`/api/admin/*` 共 **55 个路由模式**，覆盖管理员会话、管理员账号、
  应用/轮播/公告/节点维护、用户管理、稻米发放、提案审核、勋章、全站设置、
  模板、贴文下架与管理端附件上传。

这些接口已有 `docs/api/semi_auth_controller.md` 与 `docs/api/admin/*.md`，当前独立前端
既不持有管理端 token，也不调用它们。未来若单独建设管理端，应另建管理端接入表，
不要把两套 token 和本表混在一起。

### 4. 当前前端的完整后端调用边界

“统一走 `http://localhost:19006`”不等于“全部由 Rice 提供”。本地网关按路径把请求
分给不同服务：

| 网关路径 | 实际归属 | 当前前端用途 |
| --- | --- | --- |
| `/api/session`、`/api/users/me` | Rice | 登录、退出、当前用户 |
| `/pds/xrpc/com.atproto.server.refreshSession` | PDS | 刷新 PDS access JWT |
| `/pds/xrpc/com.atproto.repo.createRecord` | PDS / AT Repo | 发布帖子、评论、点赞、转发 |
| `/pds/xrpc/com.atproto.repo.deleteRecord` | PDS / AT Repo | 取消点赞、取消转发 |
| `/pds/xrpc/com.atproto.repo.listRecords` | PDS / AT Repo | 恢复当前用户对帖子是否已点赞/转发 |
| `/pds/xrpc/app.bsky.feed.getTimeline` | PDS 转发至 AppView | 临时补入当前登录用户可见的转发事件 |
| `/pds/xrpc/app.bsky.feed.getPostThread` | PDS 转发至 AppView | 帖子弹窗及评论树 |
| `/pds/xrpc/app.bsky.notification.listNotifications` | PDS 转发至 AppView | 通知列表 |
| `/post/api/posts/list`、`/post/api/posts/search` | Post Cache | 公共帖子列表、我的帖子、标签筛选和帖子搜索 |

因此帖子、评论、点赞、转发和通知虽然是“当前已用能力”，却不是 Rice 业务接口，
不能登记成 Rice 已实现。

## 第二块：Rice 当前没有、但后续需要什么

### 1. 应新增到 Rice 的业务能力

这里先记录能力和验收边界，不提前发明 URL、表名或响应结构。

| 优先级 | 后续能力 | Rice 当前情况 | 最小验收边界 |
| --- | --- | --- | --- |
| P1 | 公共用户主页与人物搜索 | 只有 `GET /api/users/me`；其他接口只在提案、节点、转账等响应里嵌入精简 public user，没有独立的公开用户详情或搜索 | 能按 Rice id、DID 或 handle 读取公开档案；支持人物搜索；绝不返回手机、邮箱、余额等私有字段 |
| P1（待定义） | 社区归属与“我的社区” | 有节点列表、节点成员名单和单个 `node_member` 布尔值，但没有用户与社区的成员关系、角色或“我的社区”查询 | 先确认“节点”是否就是产品里的“社区”；若不是，再定义社区、成员关系、角色和我的社区，不在结论前复用错误模型 |
| P2（按 UI 取舍） | 稻米汇总指标 | 有可用余额、个人流水和公开发放记录；没有“冻结余额”模型，也没有“累计获得”汇总字段 | 若继续展示冻结/累计获得，先定义业务口径，再决定由现有流水前端计算还是由 Rice 返回汇总；不能用占位数字冒充真实数据 |
| P2（阻塞记录） | 节点稻米池与任务结算 | Rice 当前没有节点稻米池余额或任务奖励结算 API，产品也尚未确认结算口径 | 当前节点稻米池统一显示 `0`；Task V1 不展示奖励、不填写金额、不冻结或划转余额，审核通过后直接完成任务。待结算 API 确认后，再把结算阶段接回状态机 |
| P2（按设置范围） | 通知与隐私偏好 | Rice 已能改档案、改绑联系方式和注销账号，但没有通知偏好或隐私偏好接口 | 只有在设置页确认具体开关及其执行方后新增；账号资料编辑可直接接现有接口 |

Task V1 已从缺口移入第一块。其余 P1/P2 项都要先确认产品语义，避免因为页面上有
一个入口就提前制造后端模型。

### 2. 产品需要，但不应新增到 Rice 的能力

| 能力 | 当前情况与正确归属 |
| --- | --- |
| 公共帖子、评论、点赞、转发 | 公开记录的权威在用户 PDS / AT Repo；Rice 不应复制一套帖子表 |
| 公共广场中的转发 | 当前 Post Cache 列表不返回 repost feed event，前端临时合并登录用户的 AppView timeline；正式缺口属于 Post Cache / AppView 的统一公共 Feed，不属于 Rice |
| 活动与商品 | 当前设计是一套帖子实体，`#活动` / `#商品` 只是触发特殊前端渲染的 tag；参与活动复用评论。第一版不需要 Rice 新建活动或商品接口 |
| 通知 | 当前由 `app.bsky.notification.listNotifications` 提供；如需“标记已读”，应先接对应 AT Protocol 能力，而不是先在 Rice 复制通知 |
| 公开帖图片 | 应走 PDS blob 与帖子 embed；Rice 附件用于头像、公告、提案等 Rice 业务资源 |
| 私信 | 已明确不在当前产品范围，不进入 Rice 缺口清单 |

## 后续维护规则

1. Rice 新增或改变 C 端能力时，先更新 Rice 自己的 `docs/api`，再更新本表。
2. 本表第二块的能力真正落地后，必须移到第一块，并补齐 Rice commit、路由、文档、
   前端调用点和运行核验结果。
3. 前端开始调用一个已有 Rice 接口时，只改“当前前端状态”和调用点；不要把它误记为
   后端新增。
4. 任何 `/pds/*`、`/post/*` 或未来其他服务的接口都必须标明真实归属，不能因为经过
   同一个网关就归到 Rice。
5. 每次核对以 `router.ex + controller/JSON view + docs/api + 前端调用点` 为静态证据；
   有可用本地栈时再补运行核验。只存在于文档、原型或 mock 的能力不算“已提供”。
