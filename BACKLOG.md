# Pathwaze — Backlog

> Forward-looking roadmap. Update at the end of each working session.
> A new Claude Code session should read this + CLAUDE.md to get oriented
> without relying on prior chat context.

Last updated: 2026-07-15

---

## 🎯 Active (near-term)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 2 | **Reply-from-threads** | Medium | Outbound replies composed in the Threads tab go back out via email or Slack so conversations continue in-app. Kept near-term (2026-07-15) because it relates to another open issue. Shares the thread storage model with #1 (Email → threads sync, now on roadmap). |

---

## 🗺️ Roadmap (later — not scheduled)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | **Email → threads sync** | Large | Inbound emails auto-land in the right project's/stakeholder's Threads tab. Needs an inbound email webhook (Resend Inbound or SendGrid Inbound Parse) + sender/subject → project routing. |
| 4 | **Schedule tab (Phase 1a merge + Phase 1b Gantt)** | Medium | Phase 1a (milestones + opt-in tasks via `show_on_schedule`) lives on the `schedule-tab` branch. ⚠️ Its migrations are numbered 022/023 which COLLIDE with main's — renumber (to the next free number) before merging. Moved to roadmap 2026-07-15. |
| 5 | **Box integration (deep)** | Large | Broader Box read/write across projects. `src/app/api/box/upload/route.ts` is a stub. |
| 7 | **In-app help page (`/help`)** | Medium | Single page + sticky sidebar TOC; mirrors the onboarding deck + FAQ. |
| 8 | **Update digest email** | Medium | Admin composes a "what's new" note → opted-in users get an email. |
| 10 | **Action-plan admin editor** | Medium | UI to define/edit a collection's review checklist so a new drawing-type collection is reviewable without a code seed. Today only the seeded As-Built plan has items. |
| 11 | **RFI email-reply (no login)** | Large | EOR/AHJ reply to an RFI by email without logging in. Needs the inbound-email webhook (shares infra with #1). |
| 13 | **Designate a task as an RFI** | Medium | Flag/mark a task as an RFI to differentiate it. Clarify intent first: visual flag/type vs. a true link/convert. |
| W1 | Picklist editor | Admin UI to manage dropdown options (stage, deal_health, contract/task types) without code edits |
| W2 | Stakeholder task checklist | Per-stakeholder action items |
| W3 | Investor portal polish | `/investor/[token]` read-only flow |
| W4 | Baseline snapshots on Systems | Track design version drift over time |
| W5 | Helioscope AI extraction | Parse a Helioscope PDF → auto-populate systems fields |
| W6 | Dark mode | |

---

## ✅ Done

| # | Item | Shipped |
|---|------|---------|
| 3 | `EMAIL_NOTIFY_SELF=true` dev override | 2026-06-11 |
| 6 | @-mention input picker (`RichTextEditor` autocomplete) | 2026-06-11 |
| 9 | @-mention in task/notes editors | 2026-06-11 |
| 12 | Dashboard: your RFIs in "Your Conversations" | 2026-06-11 |
| 14 | RFI responded / official / closed notifications | 2026-06-11 |
| 15 | Rename "Delegate to Engineer" → "Delegate to Assignee" | 2026-06-11 |
| 16 | Multi-select discipline per drawing (migration **043**) | 2026-06-11 |
| 17 | In-app rename UI (`usePrompt`, replaces `window.prompt()`) | 2026-06-11 |
| 18 | **Unify @-mentions in thread/comment composers** | 2026-07-15 — `MentionInput` (contentEditable storing plain `<@uuid>` tokens that `MessageText` already renders) wired into the task-comments + offtaker-pricing-thread composers; `parseTokenMentions()` in `rfi-notify.ts` drives feed + email notify in both API routes (skips self + private tasks). `ThreadsTab` is a read-only Slack mirror (no composer). No migration; no stored-format change. Took the lighter path. |
| — | Drawings + RFIs module + notifications (see `CHANGELOG.md` 2026-06-09) | 2026-06-09 |
| — | Systems ↔ areas many-to-many (`system_buildings`, migration **042**) | 2026-06-11 |
| — | Projects list size rollup + "Show completed tasks" toggle | 2026-07-15 |

---

## 📌 Operational / manual follow-ups (not code)

| Item | Owner | Status |
|------|-------|--------|
| IT: add `pathwaze.esa-solar.com` to Exchange safe-senders list (kills "Show images" on emails for internal users) | IT / Morgan | ✅ Done |
| Merge `feature/drawings-rfis` → `main` | — | ✅ Effectively done — `main` contains all the Drawings/RFIs code and the branch has 0 commits ahead of `main` (verified 2026-06-11). |
| Drawings + RFIs migrations **032–041** applied to Supabase | Morgan | Done |
| `CRON_SECRET` set in Vercel (Production) + `vercel.json` cron declared | Morgan / Claude | Done |
| Onboarding deck (build + screenshots) | Morgan | ✅ Done — closed per user 2026-06-11 |
| Slack app Event Subscriptions URL → confirm points at new domain | Morgan | ✅ Done |

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
