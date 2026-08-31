# Design QA

## Scope and source

- Live source: `https://xiangjian-dao-v11-preview.rickyke2023.chatgpt.site/prototype`.
- Source screens captured in this run: `② 广场`, `㊴ 发帖`, `㊵ 帖子详情`, `㊶ 全局搜索`.
- Browser viewport: `1280 × 720` CSS px, using only the Codex in-app browser.
- Local state: signed in as Mo Bob; all visible posts are real Post Cache records. No post, comment, like, repost, task, person or community mock data was added.

## Six alignment scores

The same 100-point rubric was used on each pass: information architecture 25, geometry 25, visual tokens 20, core interaction flow 20, source fidelity 10.

| Pass | Score | Improvement proved |
| --- | ---: | --- |
| 1 | 35 | Baseline exposed the unsupported hero, task strip, inline search, `社区动态` heading and logout in the header. |
| 2 | 58 | Removed unsupported layers; restored compact publish/search controls, three feed tabs and four destinations. |
| 3 | 69 | Added prototype-style post cards, avatar, tag, comment/repost/like positions and a real post-detail entry. |
| 4 | 78 | Completed the top-right search flow and proved `你好` returns the real matching Post Cache record. |
| 5 | 88 | Connected post thread reads plus like/unlike, repost/unrepost and reply writes to authenticated PDS records. |
| 6 | 94 | Matched the light mobile shell, card hierarchy, standalone search/detail/compose screens and rounded-control proportions. |

## Final evidence

- Plaza source/local: `qa/score-6-normalized-comparison.jpg`.
- Search source/local: `qa/score-6-search-comparison.jpg`.
- Post detail source/local: `qa/score-6-post-detail-comparison.jpg`.
- Compose source/local: `qa/score-6-compose-comparison.jpg`.
- Individual local captures: `qa/score-6-plaza.jpg`, `qa/score-6-search.jpg`, `qa/score-6-post-detail.jpg`, `qa/score-6-compose.jpg`.

## Flow checks

1. Plaza — healthy. The large unsupported headings are absent; only real posts are shown.
2. Category filter — healthy. Clicking `活动` returns the single real `#活动` post; `商品` uses the same real tag filter.
3. Global search — healthy. The header search opens the standalone source-aligned page, submits a real keyword and returns the real post. Task, person and community scopes are visibly disabled because no confirmed API is connected.
4. Post detail — healthy. Clicking a search result opens the authenticated AT Protocol thread with interaction counts and the comment composer.
5. Interactions — healthy without test mutation. Like/unlike and repost/unrepost map to PDS create/delete records; reply maps to an `app.bsky.feed.post` record with root and parent references. The browser run verified enabled controls and existing-state reads but did not click a write action.
6. Compose — healthy without test mutation. The header publish control opens the standalone composer; image, topic and association tools are disabled; text and Activity/Product tags use the real post-write path and wait for Post Cache visibility before returning to the plaza.

## Rounded-container geometry

- Source publish pill normalized to the local mobile width: approximately `64 × 34`; local: `70 × 32`.
- Source active feed tab normalized: approximately `84 × 38`; local final target: `81 × 36` inside a `42`-pixel group.
- Local search control is `32 × 32`, with the icon centered.
- Local first post card is inset `12` pixels from both shell edges with a `15`-pixel radius.
- Local bottom navigation spans the `430`-pixel mobile shell and keeps equal four-way columns.

## Validation limits

- The source uses illustrative content across tasks, people and communities. Those sections remain disabled instead of being populated with invented data.
- Accessibility observations from screenshots are limited to visible hierarchy, labels, disabled states and contrast; full assistive-technology compliance was not claimed.
- No automated browser action created or deleted user content or interactions.

Tests: 4 passing. Production build and TypeScript check: passing.

final result: passed
