# Pathwaze — Backlog

> Forward-looking roadmap. Update at the end of each working session.
> A new Claude Code session should read this + CLAUDE.md to get oriented
> without relying on prior chat context.

Last updated: 2026-06-11

---

## 🎯 Open items (committed to build)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | **Email → threads sync** | Large | Inbound emails (customer / vendor / stakeholder) auto-land in the right project's or stakeholder's Threads tab. Needs an inbound email webhook (Resend Inbound or SendGrid Inbound Parse) + routing logic to match sender/subject → project. |
| 2 | **Reply-from-threads** | Medium | Outbound replies composed in the Threads tab go back out via email or Slack so conversations continue in-app. Natural pair with #1 (shares the thread storage model). |
| 3 | **`EMAIL_NOTIFY_SELF=true` dev override** | ✅ Done 2026-06-11 | `shouldEmailNotify()` in `email.ts`; applied to task assign (create + reassign) + complete. Set `EMAIL_NOTIFY_SELF=true` in env to receive your own task emails. |
| 4 | **Schedule tab Phase 1b (Gantt)** | Medium | Phase 1a (milestones table + opt-in tasks via `show_on_schedule`) lives on the `schedule-tab` branch. ⚠️ That branch's migrations are numbered 022/023, which now COLLIDE with main's 022/023. Renumber them to 032/033+ before merging. |
| 5 | **Box integration (deep)** | Large | Beyond the current dataroom usage — broader Box read/write across projects. `src/app/api/box/upload/route.ts` is currently a stub (`// TODO: Upload to Box using Box SDK`). |
| 6 | **@-mention input picker** | ✅ Done (partial) | Input side shipped: `RichTextEditor` now has `@` autocomplete (pass `mentionUsers`), inserting a `<span class="mention" data-uid>` chip. Live in RFI responses (notifies the mentioned user). **Remaining:** enable it in task/notes/thread editors by passing the users list. |
| 7 | **In-app help page (`/help`)** | Medium | Single page with sticky sidebar TOC. Mirrors the onboarding deck content + FAQ. Should be updated when major features ship. |
| 8 | **Update digest email** | Medium | On hold per user. Idea: admin composes a "what's new" note, clicks a button in /admin, opted-in users get an email. Infra TBD. |
| 9 | **@-mention in task/notes editors** | ✅ Done | `mentionUsers` now wired into task description (create+edit), project new-task + note/event composers, and offtaker-pricing notes; mentions email the user + log a feed entry (create-time). |
| 18 | **Unify @-mentions in thread/comment composers** | Medium — own pass | Task comments, `ThreadsTab`, and pricing thread messages are plain-text inputs rendered via `MessageText` (Slack `<@USERID>` tokens), not the rich editors' HTML `data-uid` spans. **Two paths** found 2026-06-11: (a) **lighter** — add an @-autocomplete to the plain inputs that inserts a `<@uuid>` token, which `MessageText` ALREADY renders (resolves uuid against `users.id`); no format/renderer change; or (b) **full** — switch composers to `RichTextEditor` (HTML mentions), which changes stored message format across 3 systems + needs the renderer to handle both. Deferred to its own session per the format-risk. |
| 10 | **Action-plan admin editor** | Medium | UI to define/edit a collection's review checklist (action plan) so a newly created drawing-type collection becomes reviewable without a code seed/migration. Today only the seeded **As-Built** plan has items. |
| 11 | **RFI email-reply (no login)** | Large | Procore's marquee: EOR/AHJ reply to an RFI by email without logging in. Needs the inbound-email webhook (shares infra with #1/#2). v1 RFIs are in-app + outbound email only. |
| 12 | **Dashboard: your RFIs in "Your Conversations"** | ✅ Done 2026-06-11 | "RFIs you're involved in" block in the Your Conversations card — ball-in-court / RFI manager / received-from / distribution; drafts excluded; overdue flag. (@-mention-based involvement not yet included — structured involvement only.) |
| 13 | **Designate a task as an RFI** | Medium | On the task page, allow a task to be marked/flagged as an RFI so it's clearly differentiated from a standard task. Clarify intent first: a visual flag/type vs. a true link to (or conversion into) an RFI record. |
| 14 | **RFI responded / official / closed notifications** | ✅ Done 2026-06-11 | `notifyRfiParties()` helper in `rfi-notify.ts`. PATCH route fires on status→closed/open (transition-guarded). Responses route now differentiates New / Official / Official+closed wording (the close-via-response path notifies from here since it bypasses PATCH). |
| 15 | **Rename "Delegate to Engineer" → "Delegate to Assignee"** | ✅ Done 2026-06-11 | Modal title in `DrawingReviewView.tsx`. |
| 16 | **Multi-select discipline per drawing** | Medium — own pass | Let a drawing carry multiple disciplines; review scope = Universal + each selected section. Today `drawings.discipline_key` is single — needs a **migration** (text→array or join), review-merge, and UI multi-select. Deferred to its own session (migration-bearing). |
| 17 | **In-app rename UI (replace `window.prompt()`)** | ✅ Done 2026-06-11 | New `usePrompt()` async hook in `components/ui/usePrompt.tsx`. Swapped all 4 sites: drawing rename, RFI add-stakeholder, task change-request notes (multiline), RichTextEditor link (with selection save/restore so `createLink` still targets the original selection). |

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
