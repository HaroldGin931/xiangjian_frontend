# Design QA

## Source visual truth

- Desktop visual language: `design-reference.jpg` (`2038 × 2408`).
- User-reported prompt leakage: the three supplied screenshots combined in `design-copy-comparison.png`.
- Live flow reference: `https://xiangjian-dao-v11-preview.rickyke2023.chatgpt.site/prototype`.
- Notification reference: `source-prototype-notifications.png` (`1280 × 720`).
- Notification preference and empty-state references: `source-prototype-notification-preferences.png`, `source-prototype-empty-states.png`.

The live prototype is a mobile interaction specification. The local app remains the selected desktop visual treatment, so the comparison targets information hierarchy, navigation, state and copy rather than reproducing the prototype viewer or phone frame.

## Implementation evidence

- Plaza: `design-implementation.png` (`1280 × 1885`).
- Tasks: `design-implementation-tasks-user-facing.png` (`1280 × 1145`).
- Notifications: `design-implementation-notifications-viewport.png` (`1280 × 720`).
- Desktop style comparison: `design-comparison.png`.
- Prompt-leakage before/after comparison: `design-copy-comparison.png`.
- Notification source/implementation comparison: `design-notifications-comparison.png`.

Browser viewport: `1280 × 720` CSS px. The in-app capture maps the rendered CSS viewport into the left half of a `1280`-pixel image; the desktop comparison therefore crops the first `640` pixels and scales it to `1280` before side-by-side review. The notification comparison uses the two unmodified `1280 × 720` viewport captures.

State: Mo Alice signed in; plaza contains only real local posts; tasks and notifications use their real empty states. No task or notification mock data was introduced.

## Comparison history

### Pass 1 — blocked

- **P1 · Prompt leaked into product UI.** “V11 视觉验收版”, “接口台账”, backend/API names and mock-data explanations were visible to end users.
- **P1 · Notification flow missing.** The live prototype has a first-level message/notification destination, but the local navigation only had plaza, tasks and profile.

Fixes:

- Removed the interface-ledger route, development labels and implementation explanations from every user-facing screen.
- Rewrote plaza, login, tasks and profile copy as finished product copy. Unsupported controls remain disabled without exposing internal reasons.
- Added `/notifications` as the fourth primary navigation destination.
- Connected notification reads to the authenticated AT Protocol notification endpoint and deliberately omitted private messages.

### Pass 2 — passed

- **Fonts and typography:** serif display headings, sans-serif UI text, weights and hierarchy remain consistent with the selected desktop reference.
- **Spacing and layout rhythm:** top bar, intro, content surface and fixed pill navigation preserve the established frame and spacing; no horizontal overflow at `1280` CSS px.
- **Colors and visual tokens:** dark green background, olive surfaces, cream foreground and muted disabled states remain consistent.
- **Image and icon fidelity:** the screens contain no source imagery to reproduce; standard Bell and refresh symbols use the existing icon library rather than handmade assets.
- **Copy and content:** no developer-facing prompt text remains. The live notification source is populated, while the local account currently has zero real notifications; the empty state is intentional and avoids invented content.
- **Interactions:** plaza → notification navigation, refresh, login, task navigation, profile navigation, post search and composer open/close were exercised in the Codex in-app browser.
- **Scope:** private-message screens and private-message tabs are absent as required.

No actionable P0, P1 or P2 findings remain. The source mobile viewer and local desktop shell intentionally differ in device framing and content density.

final result: passed
