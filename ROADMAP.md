# Pathwaze — Roadmap

> Forward-looking plan: what's next, what's later, what's parked.
> Shipped history lives in [CHANGELOG.md](CHANGELOG.md). Durable how-to-work
> facts live in [CLAUDE.md](CLAUDE.md). A new session should read CLAUDE.md +
> this file to get oriented without prior chat context.

**Last updated:** 2026-08-19

---

## 🎯 Active / next up

| # | Item | Effort | Notes |
|---|------|--------|-------|
| A1 | **Reply-from-threads** | Medium | Outbound replies composed in the Threads tab go back out via email or Slack so conversations continue in-app. Shares the thread storage model with "Email → threads sync" (R1). |
| A2 | **Home dashboard — your open RFIs** (was T10) | Medium | Surface RFIs where the signed-in user is ball-in-court in the dashboard's Due-this-week / Completed / Conversations sections. Quickest visible win for the team. |
| A3 | **ClaudeCode → `#Pathwaze_bugs` automation** (was T9) | Medium (meta) | Route team feature requests / bug reports from Claude Code into the `#Pathwaze_bugs` Slack channel for triage. |

---

## 🗺️ Roadmap (later — not scheduled)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| R1 | **Email → threads sync** | Large | Inbound emails auto-land in the right project's/stakeholder's Threads tab. Needs an inbound-email webhook (Resend Inbound or SendGrid Inbound Parse) + sender/subject → project routing. |
| R2 | **Schedule tab (Phase 1a merge + Phase 1b Gantt)** | Medium | Phase 1a (milestones + opt-in tasks via `show_on_schedule`) lives on the `schedule-tab` branch. ⚠️ Its migrations are numbered 022/023 which **collide** with main's — renumber to the next free number before merging. |
| R3 | **Box integration (deep)** | Large | Broader Box read/write across projects. `src/app/api/box/upload/route.ts` is a stub. |
| R4 | **In-app help page (`/help`)** | Medium | Single page + sticky sidebar TOC; mirrors the onboarding deck + FAQ. |
| R5 | **Update digest email** | Medium | Admin composes a "what's new" note → opted-in users get an email. |
| R6 | **Action-plan admin editor** | Medium | UI to define/edit a collection's review checklist so a new drawing-type collection is reviewable without a code seed. Today only the seeded As-Built plan has items. |
| R7 | **RFI email-reply (no login)** | Large | EOR/AHJ reply to an RFI by email without logging in. Needs the inbound-email webhook (shares infra with R1). |
| R8 | **Designate a task as an RFI** | Medium | Flag/mark a task as an RFI to differentiate it. Clarify intent first: visual flag/type vs. a true link/convert. |

---

## 💡 Wishlist (unscoped)

| # | Item | Notes |
|---|------|-------|
| W1 | Picklist editor | Admin UI to manage dropdown options (stage, deal_health, contract/task types) without code edits |
| W2 | Stakeholder task checklist | Per-stakeholder action items (`stakeholder_tasks` table already exists) |
| W3 | Investor portal polish | `/investor/[token]` read-only flow |
| W4 | Baseline snapshots on Systems | Track design version drift over time |
| W5 | Helioscope AI extraction | Parse a Helioscope PDF → auto-populate systems fields |
| W6 | Dark mode | |

---

## 📌 Operational / manual follow-ups (not code)

Standing manual tasks; owner acts outside the codebase.

| Item | Owner | Status |
|------|-------|--------|
| **B1 — Slack channel auto-link config** | Morgan | Open — *not a code bug.* The events route already auto-links a channel's messages to a project when the channel is linked. To enable: (1) Events API subscribed to `message.channels` + `message.groups`, (2) events Request URL → `/api/slack/events` & verified, (3) bot invited to the channel, (4) channel linked to a project (`/pathwaze project <name>` once, or set `slack_channel_id`). |
| IT: add `pathwaze.esa-solar.com` to Exchange safe-senders list | IT / Morgan | ✅ Done |
| Drawings + RFIs migrations 032–041 applied to Supabase | Morgan | ✅ Done |
| `CRON_SECRET` set in Vercel (Production) + `vercel.json` cron declared | Morgan | ✅ Done |

---

## 🔧 Known cleanup candidates (low priority)

| Location | What | Why |
|----------|------|-----|
| `src/components/project/_editFields.tsx` | `EditInput`, `EditSelect`, `EditTextarea`, `ViewField` exports | No call sites — leftover from an older edit-mode refactor |
| `package.json` | `@supabase/auth-helpers-nextjs` | Deprecated; code uses `@supabase/ssr` exclusively. Safe to drop. |
| `src/app/api/box/upload/route.ts` | Stub TODO | Finish or remove when Box deep-integration (R3) is scoped |
| `schedule-tab` branch | Migration number collision (022/023) | Renumber before merge (R2) |

---

## Recently shipped

See [CHANGELOG.md](CHANGELOG.md) for the full record. Highlights:

- **2026-07-15** — Saved filter presets (Projects + Tasks), RFI sort/assignee filter,
  RFI attachments, drawing-review comments, subtasks, task quick-reassign,
  project-contact link, bigger drawing uploads, Slack slash-command timeout fix.
- **2026-06-11** — RFI status notifications, @-mention picker, multi-discipline drawings.
- **2026-06-09** — Drawings + RFIs module launch.

---

## Session hygiene

- One session = one coherent feature/bug. Start fresh between unrelated work.
- Durable "how we work" facts → [CLAUDE.md](CLAUDE.md); roadmap → here; shipped history → [CHANGELOG.md](CHANGELOG.md).
- Update this file + give an end-of-session summary (table format) at the close of each session.
- Don't commit/push without an explicit request.
