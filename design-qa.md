# Design QA

`qa/` 中只有本文引用的最终对照图进入 Git；源截图、单页过程截图和评分过程图仅保留在
本地并由 `.gitignore` 排除。仓库以本文件的验收结论和最终对照图为准。

## Comparison target

- Source visual truth: `https://xiangjian-dao-v11-preview.rickyke2023.chatgpt.site/prototype`.
- Source captures: `/Users/harold/.codex/visualizations/2026/08/31/01a05788-1303-7641-960d-7049ac652ae8/xiangjian-readonly-audit-2026-09-01/03-source-task-desktop.png`, `05-source-me-desktop.png`, and `08-source-notifications-desktop.png`.
- Implementation: `http://127.0.0.1:19007/`, rendered by the persistent Docker frontend and inspected only in the Codex in-app browser.
- Compared states: task, profile, notifications, plaza; authenticated as Mo Bob where an account was required. Source task/notification records are illustrative. The implementation intentionally shows real empty states because no task or social mock records were added.

## Viewport and normalization

- Source canvas: `1280 × 720` px. Its phone application region was cropped at `x=505, y=92, 270 × 582` px and normalized to `390 × 844` px.
- Mobile implementation: `390 × 844` CSS px, measured `devicePixelRatio=1`. The Codex capture transport encoded the visible page at half scale inside a `390 × 844` image, so the `195 × 422` content region was normalized back to `390 × 844` before comparison.
- Desktop implementation: `1280 × 800` CSS px. Full-page raw captures ranged from `1280 × 800` to `1280 × 935` px; the same capture-scale normalization was applied before visual inspection.
- Mobile comparison evidence:
  - `qa/task-mobile-comparison.png`
  - `qa/profile-mobile-comparison.png`
  - `qa/notifications-mobile-comparison.png`
- Desktop responsive evidence:
  - `qa/final-plaza-desktop.png`
  - `qa/final-task-desktop.png`
  - `qa/final-notifications-desktop.png`
  - `qa/final-profile-desktop.png`

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation preserves the source hierarchy with system Chinese body text and a Song-style task hero display face. Explicit Asia/Shanghai formatting now keeps server and browser timestamps identical.
- Spacing and layout rhythm: mobile header, hero, search, filter pills, metric cards, menus, and fixed four-way navigation follow the source order and proportions. Desktop expands into centered 760–940 px content regions instead of retaining a fixed phone shell.
- Colors and visual tokens: warm off-white background, deep green primary state, pale green balance surface, low-contrast borders, and visibly muted disabled controls match the source intent. The green presentation-stage side panels are absent from the product layout.
- Image quality and assets: these screens contain no required photographic or decorative raster assets. Icons use Lucide; no handcrafted SVG, emoji, CSS illustration, or fake avatar image was introduced.
- Copy and content: app copy is user-facing. Unsupported task, profile, search, and private-message actions are disabled and grey; no API/debug commentary appears in the product interface.
- Accessibility and states: semantic headings, tab roles, navigation labels, disabled controls, empty, loading, retry, expired-session, and signed-out states were inspected. No mobile clipping or hidden persistent navigation was found.

## Comparison history

1. First pass found a P2 profile ordering drift: `我的帖子` appeared before `我的任务`, unlike the source. Fixed by restoring the source menu order while keeping the unsupported task row disabled. Post-fix evidence: `qa/profile-mobile-comparison.png`.
2. Runtime inspection found a P1 hydration mismatch on plaza timestamps because Docker SSR used UTC while the browser used Asia/Shanghai. Fixed with one shared explicit-timezone formatter. A fresh browser tab then completed three plaza reloads with four identical posts, no alert, and no console warning/error.
3. Runtime inspection found a P1 Docker gateway redirect: container-to-container Rice requests used host `gateway`, which Rice redirected to unavailable `https://localhost`. Fixed the gateway to preserve Rice's configured canonical host. Profile data then loaded without the raw `fetch failed` message.
4. Final pass compared the revised mobile screens side by side and inspected all four desktop captures. No new P0/P1/P2 finding was identified.
5. Follow-up runtime inspection reproduced a P1 refresh collapse: the server-rendered four-post feed was replaced by an authenticated empty response after about 400 ms, while PDS refresh calls incorrectly used GET and raced across mounted components. Fixed by using POST, deduplicating refreshes by rotating refresh token, and keeping public Post Cache reads independent from PDS authentication. Four consecutive plaza reloads retained all four posts; two notification reloads retained a valid session.

## Focused-region evidence

Separate detail crops were not required: the normalized `390 × 844` side-by-side images keep the task hero typography, profile identity/balance/menu rows, notification tabs, disabled states, and bottom navigation readable at one-to-one target size. Desktop captures were reviewed separately for breakpoint behavior rather than source fidelity because the source only specifies a phone layout inside a presentation stage.

## Primary interactions tested

1. Fresh Rice login refreshed the Rice and PDS session and returned to plaza.
2. Plaza loaded the same four real Post Cache records over five repeated navigations before the timestamp fix and three fresh-tab reloads after it.
3. Task, notifications, profile, and plaza navigation worked at `390 × 844` and `1280 × 800`.
4. Notifications loaded a real empty feed; private messages stayed disabled.
5. Profile loaded the real Rice account and balance; unsupported actions stayed disabled.
6. No post, reply, like, repost, task, notification, person, or community record was created during QA.

## Validation

- Browser console after final rebuild: no warnings or errors in a fresh tab.
- Automated tests: 6 files, 13 tests passed.
- Production build and TypeScript check: passed.
- Docker frontend: running on port `19007`; Rice, PDS, Post Cache, AppView, PLC, gateway, and Postgres remained running.

## Follow-up polish

- P3: once real task and notification APIs are connected, verify long real-world titles and dense list rows against the same source screens.

## Tag-specialization QA · 2026-09-01

### Source and state

- Product rule source: the supplied “一套帖子，活动/商品只是 Tag” diagram and the live prototype screens for the unified composer, product-tag detail, and activity-tag detail.
- Bug-state source: `/var/folders/hw/p2sd7bcx3j5g6km12ml617600000gn/T/codex-clipboard-671f5003-7318-4f1e-8cfd-76095dd59fa0.png`.
- Live source capture: `qa/source-activity-detail.png`.
- Implementation state: the real local Mo account feed at `http://127.0.0.1:19007/`; no activity, product, repost, or comment mock record was introduced.

### Viewport and comparison evidence

- Implementation captures were taken at `390 × 844` CSS px with `devicePixelRatio=1` in the Codex in-app browser.
- The supplied activity-feed source was cropped to its first `642 × 1389` phone region, then normalized to `390 × 844` for a same-size comparison.
- Full activity-filter comparison: `qa/activity-tag-comparison.png`.
- Focused activity-detail comparison: `qa/activity-detail-comparison.png`.
- Additional implementation evidence: `qa/product-compose-mobile.png` and `qa/activity-compose-mobile.png`.

### Findings and fixes

1. P1: the activity and product tabs filtered the Post Cache response before timeline repost events were merged, so unrelated reposts entered both special feeds. Fixed by merging first and applying one exact tag predicate to every item using the original post text. Reposts of genuinely tagged original posts remain eligible.
2. P1: activity and product cards exposed the normal repost action. The repost control is now absent in both special renderers and their detail dialogs.
3. P2: only the first tag was rendered. All unique tags are now preserved; the first special tag in post-text order selects activity or product presentation while other tags retain normal tag treatment.
4. P2: activity and product publishing duplicated tag selection inline. A single kind definition now provides the tag, placeholder, button label, and grey supplementary-field labels while reusing the existing text-post API.
5. P2: special detail views reused the normal comment composer. Activity now presents a grey participation state and activity fields; product presents a grey availability state and product fields. Missing backend fields remain visibly unavailable instead of being invented in client state.

### Five fidelity surfaces

- Typography: the existing compact mobile type scale and strong green hierarchy are unchanged.
- Spacing: filter pills, post cards, special metadata tiles, composer, and fixed bottom navigation remain inside the shared `390 px` shell without clipping.
- Color: activity uses the established pale/green system; product uses a restrained warm tag treatment; unavailable fields remain muted.
- Assets: Lucide icons only; no new image, custom SVG, or illustrative asset was introduced.
- Copy and content: visible values come from Rice/Post Cache/AppView. Activity/product-specific values not present in the API are shown as em dashes with user-facing explanatory copy.

### Primary interactions tested

1. Activity filter returned exactly two real posts and every item’s original text contained the exact `#活动` tag; unrelated reposts were absent.
2. Product filter returned the real empty state; no product mock was created.
3. Activity cards showed participation state and like only; product cards use availability state and like only; neither exposes repost.
4. Activity detail opened as a modal with activity fields and no comment/repost controls.
5. Activity and product composer modes kept one text-post submission path, displayed mode-specific copy, showed a visible `0/300` input count, and appended the matching special tag only once.
6. Returning to the all-post feed retained valid repost events and did not log a browser warning or error.

### Validation

- Browser console: no warning or error after the final Docker rebuild.
- Automated tests: 6 files, 15 tests passed, including exact tag matching, multi-tag preservation, no duplicate auto-tag, and post-merge filtering.
- Production build and TypeScript check: passed.
- Docker frontend: running on port `19007` against the existing local backend stack.

final result: passed

## Task V1 and Rice account integration QA · 2026-09-01

### Source and scope

- Canonical prototype: `https://xiangjian-dao-v11-preview.rickyke2023.chatgpt.site/`.
- Source states were captured in the Codex in-app browser before implementation: task list,
  open/apply/applicants/submit/review/changes task states, my tasks, settings, account, and profile
  editing. Process captures remain ignored under `qa/`.
- Final reviewed comparisons: `qa/task-v1-list-comparison.png`,
  `qa/task-v1-detail-comparison.png`, and `qa/account-security-comparison.png`.
- The prototype phone is shown inside a green presentation stage. The implementation keeps the
  same hierarchy and tokens but uses the previously approved responsive `760 px` centered desktop
  column; it does not reproduce the green stage as product UI.

### Findings and fixes

1. P1: `/tasks/:taskId` and `/tasks/new` were nested below a `/tasks` component that rendered the
   list directly, so child routes could not appear. `/tasks` is now a layout route with `Outlet`, and
   the list lives at the dedicated task index route.
2. P1: an existing browser session retained the user object from before
   `can_publish_tasks` existed. Rice correctly authorized the user, but the frontend still showed a
   disabled publish control. Session startup now refreshes the current Rice user independently from
   PDS token refresh, so permissions and profile changes cannot remain stale.
3. P1: rebuilding Rice changed its Docker IP while Nginx retained the old resolved address and
   returned `502`. The local gateway now uses Docker DNS with a five-second resolver TTL for Rice.
4. P2: the first account implementation exposed both phone and email forms at once and no longer
   resembled the compact prototype hierarchy. The default page now shows verified login, masked
   contacts, DID, password reset, and account deletion as rows; a single change form expands only
   after the user selects a contact.
5. P2: Task and account code were simplified after runtime QA: one unused frontend application
   request and three unused backend status accessors were removed; task responses use a public-user
   type instead of pretending private account fields are present.

### Product behavior verified

1. Task state machine ran against the real Docker Rice API:
   `可领取 → 申请领取 → 确认任命 → 进行中 → 提交完成 → 待审核 → 驳回并留言 → 进行中 → 重新提交 → 审核通过 → 已完成`.
2. Rejection required and preserved the reason, retained the same assignee, and kept both submission
   attempts in the detail history.
3. The completed task appeared under Mo Bob's `我的任务 / 我承作的` after a real UI logout/login.
4. Mo Alice's refreshed profile exposed `发布任务`; Mo Bob remained explicitly unauthorized.
5. Registration, password reset, profile editing, attachment selection/upload wiring, contact changes,
   password navigation, and account deletion controls render against documented Rice endpoints.
6. The one Task QA record was deleted after verification. The local database again contains zero
   tasks, so no mock or assistant-created task content remains.
7. Node grain pool and task settlement remain an explicit blocker: the UI shows no reward fields and
   performs no balance mutation; the capability ledger records the current pool value as `0` until a
   settlement API is confirmed.

### Validation

- Rice: simplified production release compiled; complete regression suite passed,
  `578 tests, 0 failures` (one redundant applications-endpoint test was removed with that endpoint).
- Frontend: production build and TypeScript check passed; `6` test files and `19` tests passed.
- Runtime: Rice migration ran, Task endpoints returned expected statuses, the completed assignee
  history survived relogin, and the final task list returned its real empty state.
- Browser: task list, detail, my-task history, settings, profile edit, account, register, and password
  reset pages were inspected only in the Codex in-app browser.

final result: passed

## Activity/product publish and participation QA · 2026-09-01

### Source and state

- Live prototype source: `https://xiangjian-dao-v11-preview.rickyke2023.chatgpt.site/prototype`, captured in the Codex in-app browser as `qa/source-current-compose.jpg`, `qa/source-current-activity-detail.jpg`, and `qa/source-current-product-detail.jpg`.
- Reported sync state: `/var/folders/hw/p2sd7bcx3j5g6km12ml617600000gn/T/codex-clipboard-a5d918ff-d07e-4c73-9f14-fb2a84686ed4.png`.
- Implementation: `http://127.0.0.1:19007/`, authenticated as the existing Mo Bob account. QA filled forms but did not submit a post, participation reply, repost, or like.

### Viewport and comparison evidence

- Source and final implementation captures were inspected at `1280 × 720` in the Codex in-app browser. The source places its phone UI inside a presentation stage; the implementation uses the same design system in its responsive desktop layout.
- Current browser capabilities did not expose exact mobile viewport emulation, so this pass does not claim a new `390 × 844` capture.
- Unified composer comparison: `qa/compose-flow-comparison.png`.
- Activity-detail comparison: `qa/activity-detail-flow-comparison.png`.
- My-posts before/after: `qa/my-posts-before-after.png`.
- Sync-state before/after: `qa/sync-state-before-after.png`.
- Final current-run captures: `qa/after-activity-compose.jpg`, `qa/after-product-compose.jpg`, `qa/after-activity-detail.jpg`, and `qa/after-my-posts.jpg`.

### Findings and fixes

1. P1: activity/product supplementary fields were decorative grey labels. They are now real required inputs while preserving one post entity and one publish API. Activity serializes deadline, location, and conditions; product serializes price, availability, and fulfillment with the special tag.
2. P1: `/me/posts` was nested under `/me`, but the parent route rendered the profile directly and omitted TanStack Router's `Outlet`. The parent is now a layout route and `/me` has a dedicated index route, so “我的帖子” opens the real filtered list.
3. P1: successful PDS writes blocked the composer for up to 12 seconds while polling Post Cache, and the success notice reused error styling. The polling state and “发布成功，正在同步” notice were removed. The authoritative PDS result is inserted into the existing feed cache and navigation returns immediately; later normal reads reconcile with Post Cache.
4. P1: the first post-fix browser pass found native date input updates were not reaching React state under the controlled input path. Inputs now capture `input` events synchronously; the deadline is included in the 55-character serialized record and the publish button enables correctly.
5. P2: activity detail had no working participation action. “参与活动” now calls the existing reply API with `参与活动`, updates the visible participant count optimistically from the authoritative result, disables after the current user has participated, and closes after the activity deadline.

### Five fidelity surfaces

- Typography: existing compact green hierarchy remains intact; structured field labels use the established secondary scale.
- Spacing: the composer groups special fields in one pale panel; activity detail uses the existing modal and shared content width.
- Color: live special fields use the existing pale-green surface; only unsupported actions remain grey.
- Assets: existing Lucide icons only; no generated or fake asset was added.
- Copy and content: the UI contains user-facing field names and actions only. It does not expose API, Post Cache, or sync/debug language.

### Primary interactions tested

1. Activity mode required body, deadline, location, and participation conditions; all fields enabled “发布活动” without submitting it.
2. Product mode required body, rice price, availability, and fulfillment; all fields enabled “发布商品” without submitting it.
3. “我的帖子” navigated from `/me` to `/me/posts`, showed “返回个人中心”, and rendered the current account's real posts.
4. Activity detail opened in the existing dialog, omitted repost, showed structured field slots, and exposed an enabled “参与活动” action with explicit comment semantics. The action was not clicked.
5. A fresh browser pass after the final rebuild produced no application warning or error.

### Validation

- Browser console after final rebuild: no application warning or error; the only messages were Vite connection and React development-information logs.
- Automated tests: 6 files, 17 tests passed.
- Production build and TypeScript check: passed.
- Docker frontend, Rice, Post Cache, and gateway: running.

final result: passed

## Profile single-column layout QA · 2026-09-01

### Source and state

- Product hierarchy source: the profile screen in `qa/profile-mobile-comparison.png`, which orders identity, rice balance, personal functions, and logout as one continuous reading flow.
- Reported desktop bug state: `/var/folders/hw/p2sd7bcx3j5g6km12ml617600000gn/T/codex-clipboard-45e71db5-9dd4-4819-a1e1-3c065cb65fc2.png` (`1602 × 1406` px).
- Final implementation: `http://127.0.0.1:19007/me`, authenticated as the existing Mo Bob account and captured as `qa/profile-single-column-desktop.jpg` at `1280 × 720` px.
- Normalized before/after evidence: `qa/profile-single-column-before-after.png`; both sides were normalized to `720` px height for structural comparison. The bug screenshot is evidence of the rejected layout, not a pixel-fidelity target.

### Finding and fix

1. P1: the desktop-only two-column grid placed identity and rice balance in the first grid row, then forced the personal-function menu into the second row. Because the identity card was taller than the rice card, the right column contained a large empty region and the user's reading flow was split. The desktop grid, explicit grid placement, and artificial identity minimum height were removed. The page now uses the same centered `760 px` single column at every breakpoint: identity → rice balance → personal functions → logout.

### Fidelity surfaces

- Typography: unchanged; the existing profile heading, account metadata, balance, and menu hierarchy remain intact.
- Spacing and layout rhythm: sections now use one shared `10 px` vertical gap with no empty grid track; the column matches the width already used by the user's post list.
- Colors and tokens: unchanged.
- Image quality and assets: unchanged Lucide account icon; no new asset was added.
- Copy and content: unchanged real Rice account data and existing grey unsupported actions.

### Validation

- Browser: identity, rice balance, “我的帖子”, and bottom navigation rendered in one continuous column; no browser warning or error.
- Automated tests: 6 files, 17 tests passed.
- Production build and TypeScript check: passed.
- No post, reply, interaction, account, or mock record was created.

final result: passed
