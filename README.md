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

- 已接入：Rice 登录、当前用户、Post Cache 帖子列表与搜索、PDS 文字帖发布。
- 发布后会短暂显示“索引同步中”，并轮询 Post Cache，避免把“写入 PDS”误报成“广场已可见”。
- 尚未接入：Task 发布、领取、验收、拒绝；相关页面不制造 mock 数据，统一保持灰态。
- 项目不预填账号、不生成帖子，页面只展示本地后端返回的真实数据。

## 验证

```bash
npm test
npm run build
```

视觉对照结论见 [design-qa.md](./design-qa.md)。
