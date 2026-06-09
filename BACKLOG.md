# Pathwaze — Backlog

> Forward-looking roadmap. Update at the end of each working session.
> A new Claude Code session should read this + CLAUDE.md to get oriented
> without relying on prior chat context.

Last updated: 2026-06-09

---

## 🎯 Open items (committed to build)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | **Email → threads sync** | Large | Inbound emails (customer / vendor / stakeholder) auto-land in the right project's or stakeholder's Threads tab. Needs an inbound email webhook (Resend Inbound or SendGrid Inbound Parse) + routing logic to match sender/subject → project. |
| 2 | **Reply-from-threads** | Medium | Outbound replies composed in the Threads tab go back out via email or Slack so conversations continue in-app. Natural pair with #1 (shares the thread storage model). |
| 3 | **`EMAIL_NOTIFY_SELF=true` dev override** | ~10 min | Env-var flag so email notifications can be solo-tested without a 2nd account. Parallel to the existing `SLACK_DM_SELF` flag. |
| 4 | **Schedule tab Phase 1b (Gantt)** | Medium | Phase 1a (milestones table + opt-in tasks via `show_on_schedule`) lives on the `schedule-tab` branch. ⚠️ That branch's migrations are numbered 022/023, which now COLLIDE with main's 022/023. Renumber them to 032/033+ before merging. |
| 5 | **Box integration (deep)** | Large | Beyond the current dataroom usage — broader Box read/write across projects. `src/app/api/box/upload/route.ts` is currently a stub (`// TODO: Upload to Box using Box SDK`). |
| 6 | **@-mention input picker** | ✅ Done (partial) | Input side shipped: `RichTextEditor` now has `@` autocomplete (pass `mentionUsers`), inserting a `<span class="mention" data-uid>` chip. Live in RFI responses (notifies the mentioned user). **Remaining:** enable it in task/notes/thread editors by passing the users list. |
| 7 | **In-app help page (`/help`)** | Medium | Single page with sticky sidebar TOC. Mirrors the onboarding deck content + FAQ. Should be updated when major features ship. |
| 8 | **Update digest email** | Medium | On hold per user. Idea: admin composes a "what's new" note, clicks a button in /admin, opted-in users get an email. Infra TBD. |
| 9 | **@-mention in task/notes/thread editors** | Small | Capability is built (`RichTextEditor` `mentionUsers`). Just pass the active users list into the task-description, project-notes, and thread composers to light it up there too. |
| 10 | **Action-plan admin editor** | Medium | UI to define/edit a collection's review checklist (action plan) so a newly created drawing-type collection becomes reviewable without a code seed/migration. Today only the seeded **As-Built** plan has items. |
| 11 | **RFI email-reply (no login)** | Large | Procore's marquee: EOR/AHJ reply to an RFI by email without logging in. Needs the inbound-email webhook (shares infra with #1/#2). v1 RFIs are in-app + outbound email only. |
| 12 | **Dashboard: your RFIs in "Your Conversations"** | Medium | Surface RFIs you're part of (ball-in-court, on the distribution, or @-mentioned) in the dashboard's "Your Conversations" area, alongside threads. |
| 13 | **Designate a task as an RFI** | Medium | On the task page, allow a task to be marked/flagged as an RFI so it's clearly differentiated from a standard task. Clarify intent first: a visual flag/type vs. a true link to (or conversion into) an RFI record. |
| 14 | **RFI responded / official / closed notifications** | Small–Med | Slack + email when an RFI gets a response or is marked official/closed. (Response → ball-in-court + distribution already fires; add the official/closed events + confirm full coverage.) |
| 15 | **Rename "Delegate to Engineer" → "Delegate to Assignee"** | XS | Drawing-review finding action: button label + modal title in `DrawingReviewView.tsx`. |
| 16 | **Multi-select discipline per drawing** | Medium | Let a drawing carry multiple disciplines; review scope = Universal + each selected section. Today `drawings.discipline_key` is single — needs an array/join + review-merge + UI multi-select. |
| 17 | **In-app rename UI (replace `window.prompt()`)** | Medium | Drawing rename (and other rename flows) should use an in-app inline edit / modal, not the browser `prompt()` box. Apply the pattern everywhere `prompt()` is currently used across Pathwaze. |

### ✅ Shipped 2026-06-09 — Drawings + RFIs (see `CHANGELOG.md`)
As-Built **Drawings** tab (collections → upload → link area+discipline → review
against a seeded action plan → findings), **Delegate→task** + **Create RFI**, a
full Procore-style **RFIs** module, and **Phase 6 notifications** (branded email +
Slack + feed; Risk escalation; daily overdue-RFI cron). Migrations **032–041**;
buckets `drawings` + `rfi-files`. Branch `feature/drawings-rfis`.

---

## 🗂 Wishlist / parked

| # | Item | Notes |
|---|------|-------|
| W1 | Picklist editor | Admin UI to manage dropdown options (stage, deal_health, contract types, task types) without code edits |
| W2 | Stakeholder task checklist | Per-stakeholder action items |
| W3 | Investor portal polish | `/investor/[token]` read-only flow |
| W4 | Baseline snapshots on Systems | Track design version drift over time |
| W5 | Helioscope AI extraction | Parse a Helioscope PDF → auto-populate systems fields |
| W6 | Dark mode | |

---

## 📌 Operational / manual follow-ups (not code)

| Item | Owner | Status |
|------|-------|--------|
| IT: add `pathwaze.esa-solar.com` to Exchange safe-senders list (kills "Show images" on emails for internal users) | IT / Morgan | Pending |
| Merge `feature/drawings-rfis` → `main` to activate the Vercel cron (overdue-RFI reminders run on Production only) | Morgan | Pending |
| Drawings + RFIs migrations **032–041** applied to Supabase | Morgan | Done |
| `CRON_SECRET` set in Vercel (Production) + `vercel.json` cron declared | Morgan / Claude | Done |
| Onboarding deck — embed 11 platform screenshots | Morgan | In progress (deck built, screenshots pending) |
| Slack app Event Subscriptions URL → confirm points at new domain | Morgan | Verify |

---

## 🔧 Known cleanup candidates (low priority)

| Location | What | Why |
|----------|------|-----|
| `src/components/project/_editFields.tsx` | `EditInput`, `EditSelect`, `EditTextarea`, `ViewField` exports | No call sites — leftover from an older edit-mode refactor |
| `package.json` | `@supabase/auth-helpers-nextjs` | Deprecated; code uses `@supabase/ssr` exclusively. Safe to drop. |
| `src/app/api/box/upload/route.ts` | Stub TODO | Finish or remove when Box deep-integration (#5) is scoped |
| `schedule-tab` branch | Migration number collision (022/023) | Renumber before merge |

---

## Session-hygiene reminders

- One session = one coherent feature/bug. Start fresh between unrelated work.
- Durable facts live in `CLAUDE.md`; roadmap lives here; shipped history in `CHANGELOG.md`.
- Update this file + give an EOD summary (table format) at the close of each session.
- Don't commit/push without explicit user request.
