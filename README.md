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

- 已接入：Rice 登录、当前用户、Post Cache 帖子列表与搜索、PDS 文字帖发布、AT Protocol 通知列表。
- 发布后会短暂显示“索引同步中”，并轮询 Post Cache，避免把“写入 PDS”误报成“广场已可见”。
- 尚未接入：Task 发布、领取、验收、拒绝；相关页面不制造 mock 数据，统一保持灰态。
- 私信不在当前产品范围内；通知保留为一级入口，并直接读取当前账号的真实通知。
- 项目不预填账号、不生成帖子，页面只展示本地后端返回的真实数据。

## 已知问题

- **公共转发还没有统一的公共 Feed 接口。** 转发记录本身是公开的，但当前 Post Cache 的 `/post/api/posts/list` 只返回顶层 `app.bsky.feed.post`，不会返回 `app.bsky.feed.repost` 对应的 feed event。前端的临时方案是在客户端已有登录会话时，通过 AppView timeline 合并 `reasonRepost`；广场路由返回时会等待这份完整 feed 后再展示，避免先显示原帖、再补转发的闪烁。该方案不能让未登录用户看到公共转发；正式修复应由 Post Cache/AppView 提供一次返回原帖和公开转发的统一广场 feed，届时删除前端合并逻辑。

## 验证

```bash
npm test
npm run build
```

视觉对照结论见 [design-qa.md](./design-qa.md)。
