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
