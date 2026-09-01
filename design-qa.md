# Design QA

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
- Automated tests: 5 files, 7 tests passed.
- Production build and TypeScript check: passed.
- Docker frontend: running on port `19007`; Rice, PDS, Post Cache, AppView, PLC, gateway, and Postgres remained running.

## Follow-up polish

- P3: once real task and notification APIs are connected, verify long real-world titles and dense list rows against the same source screens.

final result: passed
