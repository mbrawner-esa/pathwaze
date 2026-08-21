# Pathwaze — Roadmap

> Forward-looking plan: what we're working, what's next, what's parked.
> Shipped history lives in [CHANGELOG.md](CHANGELOG.md). Durable how-to-work
> facts live in [CLAUDE.md](CLAUDE.md). A new session should read CLAUDE.md +
> this file to get oriented without prior chat context.

**Last updated:** 2026-08-21 — full re-organization. Every open item across
ROADMAP, the archived BACKLOG, the original product-design sessions, and the
Aug 2026 feature batch was consolidated, de-duplicated, and triaged into the
buckets below. Items reviewed and closed during that pass are listed under
*Dropped in the 2026-08-21 triage* so they don't get re-raised as new ideas.

**Buckets:** **Working List** = actively being built or next up ·
**Roadmap** = committed, not yet scheduled · **Wishlist** = wanted, unscoped ·
**Punchlist** = small technical follow-ups on shipped work.

---

## 🔨 Working List (active / next up)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| **W-1** | **Reply-from-threads** | M | Outbound replies composed in the Threads tab go back out via email or Slack so conversations continue in-app. Requires adding delegated **`Mail.Send`** to the "Pathwaze Mail" Azure app (today's grant is read-only) — a new tenant admin-consent step. Builds directly on the shipped Outlook→Threads sync. |
| **W-2** | **Design drift / baseline comparison on Systems** | M | `design_rev` (migration 052) already stamps *that* a system changed and when. This is the other half: retain the prior revision's values so you can see *what* changed between revs — design version history on the Technical tab. |
| **W-3** | **ClaudeCode → `#Pathwaze_bugs` Slack automation** | M | Route team feature requests / bug reports from Claude Code into the `#Pathwaze_bugs` channel for triage, so intake stops living in ad-hoc sessions. |

---

## 🗺️ Roadmap (committed — not yet scheduled)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| **R-1** | **Signal capture for the Priority Dashboard** | S | Groundwork for R-2 and the cheapest item on this list. `stage` and `deal_health` changes **are** now logged to `activity_log` (`LOGGED_FIELDS` in `src/app/api/projects/[id]/route.ts`). **Milestone changes are not logged at all** — `src/app/api/milestones/[id]/route.ts` writes no activity. Close that gap first; R-2 needs the history to already exist. |
| **R-2** | **Priority Dashboard / pipeline health** | L | A deeper view of the manual red/yellow/green (`projects.deal_health`), pulling context from Slack/email threads, completed tasks, and upcoming schedule items. Shows PMs and senior leaders where priorities are and **how they changed this week** — which is why R-1 comes first. |
| **R-3** | **Your open RFIs in Due-this-week / Completed** | S | Partially shipped: RFIs where you're ball-in-court already appear in the dashboard's "Your conversations" card. Still missing from the **Due-this-week** and **Completed** sections. |
| **R-4** | **Box integration (deep)** | L | Broader Box read/write across projects. `src/app/api/box/upload/route.ts` is a `TODO` stub. ⚠️ Gated on the Dataroom re-definition (**Wishlist L-2**) — don't build the plumbing before the concept is settled. |

---

## 💡 Wishlist (wanted — unscoped)

| # | Item | Notes |
|---|------|-------|
| **L-1** | **Threads AI categorization** | Auto-organize thread items by topic/discipline (technical, financial, permitting…). The search / sort / collapse half of Threads organization shipped 2026-08-21; this is the AI half. Needs net-new schema — `project_threads` has no category columns today. |
| **L-2** | **Dataroom — re-define the concept, then un-hide it** | The Dataroom was ideated in the original prototype but never fully defined. Needs a design pass before any build. Both entry points stay commented out until this lands: the `Dataroom` item in `NAV_ITEMS` (`src/components/layout/NavBar.tsx`) and the `dataroom` project tab in `TABS` (`src/components/project/ProjectDetailClient.tsx`). Un-hiding both is part of this item. Feeds **R-4**. |
| **L-3** | **In-app help page (`/help`)** | Single page + sticky sidebar TOC mirroring the onboarding deck + FAQ, Slack-heavy since that needs the most user training. Intended as a live URL refreshed as major changes ship. No `/help` route exists today. |
| **L-4** | **Update digest email** | Admin composes a "what's new" note → opted-in users get an email. Pairs with L-3 (the help page is the canonical doc; the digest is the nudge). |

---

## 🔧 Punchlist (small follow-ups on shipped work)

| # | Item | Notes |
|---|------|-------|
| **P-1** | **Graph webhooks instead of delta polling** | The Outlook email sync currently polls via a daily Vercel cron. Microsoft Graph change notifications (webhooks) would make ingestion near-real-time and drop the cron dependency. Deliberately deferred at scoping time; revisit when polling latency actually bites. |

---

## 📌 Operational / manual follow-ups (not code)

Standing manual tasks; owner acts outside the codebase.

| Item | Owner | Status |
|------|-------|--------|
| **Slack channel auto-link config** | Morgan | **Open** — *not a code bug.* The events route already auto-links a channel's messages to a project when the channel is linked. To enable: (1) Events API subscribed to `message.channels` + `message.groups`, (2) events Request URL → `/api/slack/events` & verified, (3) bot invited to the channel, (4) channel linked to a project (`/pathwaze project <name>` once, or set `slack_channel_id`). |
| **AdventHealth 21460 data cleanup** | Morgan | **Open** since 2026-06-10. (a) Pick the real *selected* pricing per project — the imported ESA term sheets landed with `is_selected=false`, so each project's selected quote is still a placeholder `Option A`. (b) Delete 2 test buildings in 21460-FL-0012 with malformed `parcel_id`s (leading whitespace). (c) Remove 16 placeholder `Option A` pricing rows + the IL-0001 extras (`Option B`, `QT-2026-0521_v1`). |
| **Rotate the MS client secret** | Morgan | Calendar item — the "Pathwaze Mail" secret was created 2026-08-20 with a **24-month** expiry. Rotate before **~Aug 2028** or the email sync silently stops. |
| `TOKEN_ENC_KEY` identical in Vercel and `.env.local` | Morgan | Standing constraint — local dev and prod share the same Supabase DB, so a mismatched key means the stored Outlook refresh token can't be decrypted. |
| Email-sync cron cadence | — | **Closed** — staying on Vercel **Hobby**, so the sync runs daily (`0 11 * * *`). A `*/15` schedule would need Pro; not pursuing. |
| IT: add `pathwaze.esa-solar.com` to Exchange safe-senders list | IT / Morgan | ✅ Done |
| Migrations 032–041 (Drawings/RFIs), 044–048, and 049–052 applied to Supabase | Morgan | ✅ Done — **latest applied: 052. Next free number: 053.** |
| `CRON_SECRET` set in Vercel (Production) + `vercel.json` cron declared | Morgan | ✅ Done |

---

## 🧹 Cleanup candidates (low priority)

| Location | What | Why |
|----------|------|-----|
| Branches `feature/drawings-rfis`, `outlook-email-integration`, `threads-organization` | Delete (local + remote) | All **0 commits ahead of `main`** — fully merged, nothing to lose |
| Branch `meter-usage-dataset-fields` | Delete (local + remote) | Its work is already in `main` as commit `157ca69`; the branch is a stale duplicate |
| Branch `schedule-tab` | Delete (local + remote) | Holds the old Phase 1a code (milestones + opt-in tasks via `show_on_schedule`), superseded by the coming Schedule re-design. Never merge it as-is — its migrations are numbered **022/023, which collide with main's**. |
| `src/components/project/_editFields.tsx` | `EditInput`, `EditSelect`, `EditTextarea`, `ViewField` exports | No call sites — leftover from an older edit-mode refactor |
| `package.json` | `@supabase/auth-helpers-nextjs` | Deprecated; code uses `@supabase/ssr` exclusively. Safe to drop. |
| `src/app/api/box/upload/route.ts` | `TODO` stub | Finish or remove when Box deep-integration (R-4) is scoped |
| `scripts/_import-data.json`, `scripts/parse-adventhealth.py` | Untracked leftovers from the bulk data loads | Commit them or delete them |
| `.claude/launch.json` | Untracked | Decide: commit it or add to `.gitignore` |

---

## Dropped in the 2026-08-21 triage

Reviewed and deliberately closed — recorded here so they aren't re-raised as new ideas.

| Item | Note |
|------|------|
| Stakeholder drawer shows synced Outlook/Slack emails | Dropped |
| RFI email-reply without login | Dropped |
| Action-plan admin editor | Dropped |
| Designate a task as an RFI | Dropped |
| Picklist editor (admin-managed dropdown options) | Dropped |
| Field reordering in edit views | Dropped |
| Custom fields (Salesforce-style) | Declined at original design time |
| Stakeholder task checklist | Dropped — the `stakeholder_tasks` table stays unused |
| Investor portal polish | Dropped |
| Helioscope AI extraction | Dropped |
| Dark mode | Dropped |
| Email-sync 15-minute cron | Dropped — staying on Vercel Hobby |
| All prior Schedule work — Phase 1a merge, Phase 1b Gantt, un-hide the Schedule tab, Master Gantt / cross-site reporting | Dropped. The Schedule tab is being **entirely re-designed and re-scoped** from scratch; none of the earlier plan carries forward. The `schedule-tab` branch is a delete candidate (see Cleanup). |

---

## Recently shipped

See [CHANGELOG.md](CHANGELOG.md) for the full record. Highlights:

- **2026-08-21** — Project **Tasks** tab; Outlook email → project Threads (read-only Graph sync,
  migrations 049/050); Threads reorganization (unified sortable/searchable feed,
  collapsible Slack + email, note/task/file composer); activity deep-linking
  (feed + notification bell → the exact record, `?focus=<id>` opens the drawer);
  per-tab activity feeds; meter usage-dataset fields (051); auto system
  revisions + Site Plan records (052).
- **2026-07-15** — Saved filter presets (Projects + Tasks), RFI sort/assignee
  filter, RFI attachments, drawing-review comments, subtasks, task
  quick-reassign, project-contact link, bigger drawing uploads, Slack
  slash-command timeout fix.
- **2026-06-11** — RFI status notifications, @-mention picker, multi-discipline
  drawings.
- **2026-06-09** — Drawings + RFIs module launch.

---

## Session hygiene

- One session = one coherent feature/bug. Start fresh between unrelated work.
- Durable "how we work" facts → [CLAUDE.md](CLAUDE.md); roadmap → here; shipped history → [CHANGELOG.md](CHANGELOG.md).
- Update this file + give an end-of-session summary (table format) at the close of each session.
- Don't commit/push without an explicit request.
