# Pathwaze — Roadmap

> Forward-looking plan: what we're working, what's next, what's parked.
> Shipped history lives in [CHANGELOG.md](CHANGELOG.md). Durable how-to-work
> facts live in [CLAUDE.md](CLAUDE.md). A new session should read CLAUDE.md +
> this file to get oriented without prior chat context.

**Last updated:** 2026-08-31 — Four reporting items scoped from a batch of
feature requests and added as **R-11–R-14**: two weekly (Aging & Stalled Work,
Exit Gate Readiness) and two monthly (a department engagement digest, automated
trend snapshots). All four build on **R-10**'s lookahead engine or its inputs
rather than starting fresh — see each entry for what's live vs. dormant.
Earlier — 2026-08-26: **Workstreams shipped and is live** (migrations
054–068). Department tags and the on-hold pause landed with it; the lookahead
those two feed is **R-10**, scoped as the first slice of Reports rather than
a bolt-on. Earlier: layout decided (Option A, inline accordion) from a
three-option mock, with the rejected alternatives recorded in Appendix A.
Earlier still: full re-organization. Every open item across
ROADMAP, the archived BACKLOG, the original product-design sessions, and the
Aug 2026 feature batch was consolidated, de-duplicated, and triaged into the
buckets below. Items reviewed and closed during that pass are listed under
*Dropped in the 2026-08-21 triage* so they don't get re-raised as new ideas.

**Buckets:** **Working List** = actively being built or next up ·
**Roadmap** = committed, not yet scheduled · **Wishlist** = wanted, unscoped ·
**Punchlist** = small technical follow-ups on shipped work.

---

## 🔨 Working List (active / next up)

W-0 and W-0b are **done**; they stay listed until the team has used Workstreams
for a cycle and the punchlist from real use is clear. W-1…W-3 carry over.

| # | Item | Effort | Notes |
|---|------|--------|-------|
| **W-0** | **Workstreams tab** — ✅ **live 2026-08-26** | **XL** | Migrations **054–068**, all applied. Hierarchy: workstream → major milestone (fixed catalog) → milestone → real `tasks`. Each milestone carries a target plus an admin-locked baseline; variance between them drives an On Track / At Risk / Delayed light. Also shipped: weighted progress, exit gates that can require a milestone from any workstream, an update thread interleaving completed tasks, a deal-health suggestion with override, department tags, and the on-hold pause. Full spec: [Appendix A](#appendix-a--workstreams-tab-spec). The `milestones` table is retired and unread — a follow-up migration drops it. ⚠️ Almost nothing is dated yet, so timelines and traffic lights will look empty until baselines are set. |
| **W-0b** | **Stage taxonomy + On Hold** — ✅ **done** (migration 062) | **S** | Eleven lifecycle values (Pre-Planning → Operation, plus On Hold and Archived), now sourced from **`src/lib/stages.ts`** instead of five hardcoded lists that had drifted apart. Archiving still rides on `stage = 'Archived'`. Fixed three paths that were still writing the pre-018 value `'Prospecting'`. ⚠️ The taxonomy has no post-Operation stage; if projects are ever tracked past that, it needs one. |
| **W-1** | **Reply-from-threads** | M | Outbound replies composed in the Threads tab go back out via email or Slack so conversations continue in-app. Requires adding delegated **`Mail.Send`** to the "Pathwaze Mail" Azure app (today's grant is read-only) — a new tenant admin-consent step. Builds directly on the shipped Outlook→Threads sync. |
| **W-2** | **Design drift / baseline comparison on Systems** | M | `design_rev` (migration 052) already stamps *that* a system changed and when. This is the other half: retain the prior revision's values so you can see *what* changed between revs — design version history on the Technical tab. |
| **W-3** | **ClaudeCode → `#Pathwaze_bugs` Slack automation** | M | Route team feature requests / bug reports from Claude Code into the `#Pathwaze_bugs` channel for triage, so intake stops living in ad-hoc sessions. |

---

## 🗺️ Roadmap (committed — not yet scheduled)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| **R-1** | **Signal capture for the Priority Dashboard** | S | ⚠️ **Blocked by / folded into W-0.** `stage` and `deal_health` changes **are** now logged to `activity_log` (`LOGGED_FIELDS` in `src/app/api/projects/[id]/route.ts`); milestone changes are not. But the route that would need the fix (`src/app/api/milestones/[id]/route.ts`) is **deleted** by Workstreams (Appendix A req. 11) — so build the logging into the Workstreams write paths and R-1 closes with W-0. Don't patch the old route. R-2 still needs this history to exist before it can be built. |
| **R-2** | **Priority Dashboard / pipeline health** | L | A deeper view of the manual red/yellow/green (`projects.deal_health`), pulling context from Slack/email threads, completed tasks, and upcoming schedule items. Shows PMs and senior leaders where priorities are and **how they changed this week** — which is why R-1 comes first. |
| **R-3** | **Your open RFIs in Due-this-week / Completed** | S | Partially shipped: RFIs where you're ball-in-court already appear in the dashboard's "Your conversations" card. Still missing from the **Due-this-week** and **Completed** sections. |
| **R-4** | **Box integration (deep)** | L | Broader Box read/write across projects. `src/app/api/box/upload/route.ts` is a `TODO` stub. ⚠️ Gated on the Dataroom re-definition (**Wishlist L-2**) — don't build the plumbing before the concept is settled. |
| **R-5** | **Finalize the Financial section** | M | Close out the remaining gaps on the project Financial tab so it's the system of record rather than a partial view. Needs a scoping pass to enumerate what "finalized" means field-by-field. |
| **R-6** | **Development budget module** | L | New module (not a Financial-tab field set): upload and track quotes per site rolling up into a development budget per project. Pairs with R-5 and feeds R-8 reporting. |
| **R-7** | **EPC bidding portal** | L | Invite contractors to bid. External-facing, so it needs an access model — likely token-scoped like the existing investor portal (`/investor/[token]`) rather than full accounts. Consumes the development budget (R-6). |
| **R-8** | **Reports** | L | Consumer of the Workstreams data model (W-0): high-level Gantt, critical path, next milestone, estimated milestone dates, cross-project rollups. W-0 shipped with its fields designed as report inputs, so the data is in place. **R-10 is the first slice of this** — build it as part of Reports, not as a bolt-on. |
| **R-9** | **Revise the As-Built review questions** | S | Content pass on the seeded As-Built action plan (`action_plans` / `action_plan_sections` / `action_plan_items`). Data change, not code — but note there is deliberately **no admin editor** for action plans (dropped in triage), so revisions ship as a migration. |
| **R-10** | **Lookahead view** (first slice of Reports) | M–L | "What lands in the next N days, and who gets pulled in." Upcoming milestones in a rolling window, filterable by **department** and groupable by project or team — so Engineering can see it is needed for site walks ~30 days out without reading 19 project pages. ⚠️ **Its inputs already exist and are live**: department tags on milestones and tasks (migration 068), target + baseline dates, and `projects.on_hold_at`. **Held projects must be excluded** — that is half of why the on-hold pause was built. Two open questions: does a person see their *own* department automatically (needs users→departments, currently unmodelled), and does this live on /dashboard, a new /lookahead route, or inside Reports? |
| **R-11** | **Aging & Stalled Work** (weekly) | M | Two distinct signals, not one: *stalled* (no status movement in 14+ days) and *late* (open past its planned start) — deliberately different from simply "overdue." **Stalled needs no new schema**: milestone status changes are logged (`field_changed`/`status`, closed with W-0's R-1) and task status changes are logged separately (`status_changed`, already consumed by /dashboard's "Completed" card) — "days since last status movement" is a `MAX(created_at)` lookup against `activity_log` per entity, not a new column. ⚠️ **"Planned start" has no live source yet**: `workstream_milestones.start_date` exists in schema (migration 054, survived the 055 rename) but was never added to `WRITABLE` in `api/workstreams/milestones/[id]/route.ts` or exposed in `WorkstreamPlan.tsx` — it's dormant, unpopulated schema, the same category as the retired `milestones` table. Either wire it up as a real editable field, or redefine "late" against the target instead (`rollUpMajor`'s existing `overdueCount`) — a different claim ("won't make its date" vs. "hasn't begun") that the request as phrased does not intend. **Grouping by owner** is clean for tasks (`assignee_id`) but milestones themselves carry no owner — ownership was consolidated to the *major* in migration 055 (`workstream_major_state.owner_id`), so a stalled milestone's "owner" is really its major's owner. Scope across both tasks and milestones — that is the two-tier model Workstreams already draws. |
| **R-12** | **Exit Gate Readiness — Lookahead** (weekly) | S | "What gate deadlines land in the next 2 weeks, reviewed in the team meeting." Gates themselves (`workstream_gates`) carry no date of their own — they're pass/fail state (`workstream_gate_status`) attached to a major, so "the gate's deadline" is really the major's own derived window (`rollUpMajor().end`). This is **R-10's engine with a narrower filter** (majors carrying an open gate, window ≤ 14 days) rather than a separate build — scope it as a lens on R-10, the same relationship R-10 has to R-8. |
| **R-13** | **Department Engagement Newsletter** (monthly, emailed) | M | Auto-generated digest to department heads (Jason, Dave, Wes, …) — "what's coming at your team in the next 30 days," informational, not a task list. Directly consumes **R-10**: same lookahead window, filtered to one department, delivered instead of browsed. Needs two things R-10 doesn't: **(1) a recipient model** — `users` has no department column, and department heads may not need Pathwaze accounts at all, so a lightweight `department_heads` (department_key → name/email) table is the likely shape — distinct from R-10's own open question of whether a *logged-in* user sees their own department; **(2) a send path** — `sendNotificationEmail` (`src/lib/email.ts`) is the existing branded shell to extend, not a new one to build. ⚠️ **Cron capacity**: Vercel **Hobby** allows 2 cron jobs total and both are already spoken for (`rfi-reminders`, `email-sync`) — a monthly send needs either a Pro upgrade or bolting onto an existing daily cron with a day-of-month gate, the same pattern already used to fold `task-reminders` into `rfi-reminders`. |
| **R-14** | **Automated monthly trend snapshots** | M | Deteriorating-vs-accelerating trend analysis (slippage by milestone / department / user) needs *historical* state to diff against, and nothing captures that today — `activity_log` records deltas (a field changed from A to B), not a full point-in-time snapshot of every rollup. Net-new: a monthly job writing derived state (`rollUpMajor` output — health, variance, pct, slip — per major, per project) to an archive table. ⚠️ **Start the capture now, independent of any report UI.** This is the one item in this batch where delay has a real cost: the value is entirely in accumulated history, and every month not captured is a month permanently missing from a future QBR trend line, unlike R-11–R-13 which can be built any time against live state. Same Hobby cron-capacity note as R-13 applies. Explicitly retrospective (per the request) — lower priority than R-11/R-12 for real-time action, but higher urgency to *start*, for the reason above. |

---

## 💡 Wishlist (wanted — unscoped)

| # | Item | Notes |
|---|------|-------|
| **L-1** | **Threads AI categorization** | Auto-organize thread items by topic/discipline (technical, financial, permitting…). The search / sort / collapse half of Threads organization shipped 2026-08-21; this is the AI half. Needs net-new schema — `project_threads` has no category columns today. |
| **L-2** | **Dataroom — re-define the concept, then un-hide it** | The Dataroom was ideated in the original prototype but never fully defined. Needs a design pass before any build. Both entry points stay commented out until this lands: the `Dataroom` item in `NAV_ITEMS` (`src/components/layout/NavBar.tsx`) and the `dataroom` project tab in `TABS` (`src/components/project/ProjectDetailClient.tsx`). Un-hiding both is part of this item. Feeds **R-4**. |
| **L-3** | **In-app help page (`/help`)** | Single page + sticky sidebar TOC mirroring the onboarding deck + FAQ, Slack-heavy since that needs the most user training. Intended as a live URL refreshed as major changes ship. No `/help` route exists today. |
| **L-4** | **Update digest email** | Admin composes a "what's new" note → opted-in users get an email. Pairs with L-3 (the help page is the canonical doc; the digest is the nudge). |
| **L-5** | **Technical Department Dashboard integration** | Connect Pathwaze to another ESA team's internal app, distributed as a Slack app: `https://esasolar.slack.com/marketplace/A0BEVJ32K5F-technical-department-dashboard`. Unscoped — first question is what the integration surface actually is (does that app expose an API/webhook, or is Slack the only channel?). Needs a conversation with the owning team before any design. |

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
| **Run migrations `064_task_bugfix_batch.sql` + `065_permit_attachments.sql`** | Morgan | ⚠️ **Open — blocks the 2026-08-26 bug batch.** 064: `project_notes.category` (notes in per-tab Activity feeds), `task_threads.edited_at` (comment editing), 4 × `users.notify_*` (approval + due-date opt-outs). 065: `permit_attachments`. **Until 064 runs, Add Note fails outright** — the insert carries a column the DB lacks. Permit attachments degrade quietly (no counts, upload errors) until 065 runs. |
| **Run migration `054_workstreams.sql` on Supabase** | Morgan | ⚠️ **Open — blocks all Workstreams verification.** Creates the catalog + 5 per-project tables, the depth-cap and cycle-prevention triggers, and seeds 13 majors + their gates/objectives. Until it runs, the Workstreams tab renders empty and "Next Milestone" shows "—" everywhere (the app degrades rather than erroring — confirmed). |
| Migrations 032–041 (Drawings/RFIs), 044–048, and 049–052 applied to Supabase | Morgan | ✅ Done — **latest applied: 052. 053 written, not run. Next free number: 055.** |
| **`CRON_SECRET` set in Vercel (Production)** | Morgan | ⚠️ **Open — was recorded ✅ Done but is NOT set.** Verified 2026-08-26: `/api/cron/rfi-reminders`, `/api/cron/email-sync` and `/api/cron/task-reminders` all return 200 to an unauthenticated GET, so anyone with a URL can fire team-wide Slack DMs + emails or trigger a mailbox sync. The gate now fails **closed** (`src/lib/cron-auth.ts` — 503 when the secret is missing), so **until this is set the three cron jobs will not run at all.** Set it in Vercel → Project → Settings → Environment Variables (Production), then redeploy. `vercel.json` crons are declared. |

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

- **2026-08-26** — Workstreams tab (migrations 054–063, tab hidden for the
  first release); task-assigned emails render the rich-text description instead
  of escaping it.
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

## Appendix A — Workstreams tab spec

Scope for **W-0**. Captured 2026-08-21 from the product owner; this replaces the
old "Schedule" tab entirely. Treat this as the requirements source, not a
design — the data model and component breakdown still need a design pass.

### Intent

Orient the user around **major project milestones** and the action plans, stage
gates, and objectives belonging to each — *not* a traditional Gantt chart, which
has proven hard to read. The question the tab answers is "what does **the
project** need to complete for this milestone," not "what is one person assigned."

### Layout decision — Option A, inline accordion (2026-08-24)

Three treatments were mocked and reviewed: **A** inline accordion, **B** rail +
drawer, **C** two-pane master/detail. **Option A is chosen.** Interactive mock
(all three, plus the Overview view) is published at
`https://claude.ai/code/artifact/ec757311-37f5-4cb8-8616-e9ee64900747`.

Option A is the literal reading of the vertical-spine sketch: one column,
milestones expand in place, nothing hidden behind a click-through. It is also
the least new UI of the three.

Its one known weakness — **an open action plan pushes later milestones
off-screen**, so you lose the sense of the whole path while working a stage —
should be designed against rather than accepted:

- **One open at a time.** Expanding a milestone collapses the previously open
  one, so the page never grows unboundedly.
- **Sticky milestone header.** The expanded milestone's name + dates + days
  remaining pin to the top of the section while its plan is scrolled, so you
  always know which stage you are inside.
- **Scroll anchoring on collapse.** Collapsing returns the spine to the same
  scroll position, not to the top.
- **Default to the active stage open** on load — that is the stage a PM wants
  99% of the time. (Mock does this already.)

The mock predates req. 12, but the reframe there ("subs *are* the steps") means
it is structurally right — it needs only dates on each sub and one example of a
sub with sub-subs. Nesting depth is unchanged from what was reviewed.

Options B and C are recorded as rejected; don't re-litigate them without new
information. B's argument was drawer reuse (`?focus=` deep-links) — note that
Option A still has to answer deep-linking: **`?focus=<milestoneId>` must expand
that milestone and scroll to it**, which is the accordion equivalent of
`useFocusRow` opening a drawer.

### Requirements

| # | Requirement | Notes / open questions |
|---|-------------|------------------------|
| 1 | **Vertical timeline UI** — a vertical line with a greyed-out dot per milestone name. Expanding a milestone reveals its action plan **in place** (Option A, see decision above). | Visual and interactive, but **simple until expanded** — collapsed state should read at a glance. Dot states settled in the mock: grey/hollow = upcoming, green = complete, gold + halo = active, amber + halo = at risk. Collapsed row carries name, status tags, predecessor tags, the three date metrics, and a thin progress bar. |
| 2 | **Workstream selector** — dropdown at the top right of the section cycling between **Overview**, **Financial**, **Technical**, **Approvals**. | Multiple workstreams exist per project simultaneously. **Overview** is the one that shows the *relationships between* workstreams — that view is the hardest part of the design and should not be treated as just "all of them concatenated." |
| 3 | **Dates & duration** — start date, end date, estimated days remaining, total days in stage. | **Entered on sub-milestones; derived on majors** (req. 12). "Estimated days remaining" is always derived. Still to decide: whether total-days-in-stage means planned duration or actual elapsed. |
| 4 | **Action-plan window** — clicking the current stage opens a panel showing each work step with notes and risks, plus the **stage gates** and **key objectives** for that stage. | Stage gates and objectives are milestone-level attributes; work steps, notes, and risks are step-level. |
| 5 | **Weekly updates** — PMs log a weekly update against the workstream. | Log, not overwrite — the history is what feeds R-2 (priority dashboard) and R-8 (reports). |
| 6 | **Re-prioritize within the action plan** — PMs reorder steps so the highest-priority work is visible. | Ordering is user-controlled, so it needs a persisted sort key, not derived ordering. |
| 7 | **Co-owners + @-mentions** — the workstream owner can tag a co-owner to work alongside them, with @ messaging. | Use the existing `RichTextEditor` `@`-autocomplete + `parseMentions()` path (see CLAUDE.md conventions — do **not** introduce a third mention system). |
| 8 | **Every field is a report input** — all workflow-step fields must be modeled so the future Reports feature (**R-8**) can produce high-level Gantt, critical path, next milestone, and estimated-milestone views. | This constrains the schema design: dates, durations, dependencies, and completion must be first-class columns, not free text buried in notes. |
| 9 | **Sub-milestone dependencies** — a sub can declare its predecessor(s), and **a dependency may cross workstreams** (a Financial sub can block a Technical sub). Both confirmed 2026-08-21, in scope for v1. | Edges live at the **sub** level only (req. 12); major-level dependencies are derived for display. Required for critical path (req. 8) and for deriving "estimated days remaining" (req. 3) across a chain. Implies an edge table scoped to the *project*, not the workstream, plus cycle prevention on write. ⚠️ The mock exposed the real constraint: **a date edit that puts a sub before its predecessor must be rejected or flagged** — with dependencies this dense, that check fires constantly. Cross-workstream edges are the substance of the **Overview** view (req. 2). |
| 10 | **Permitting lives inside the Approvals workstream** (confirmed 2026-08-21) — its process/workflow and steps, with notes, are modeled as action-plan steps under Approvals. | Not a fifth dropdown option; the dropdown stays the four options in req. 2. The workstream is **independent of the existing `permits` table / Permitting tab** — no linkage. |
| 11 | **Workstreams is the project's single source of truth for schedule and it replaces every existing milestone element** (confirmed 2026-08-21). The old `milestones` table and all its read/write surfaces retire; "Next Milestone" on the project overview is derived from Workstreams. | ⚠️ This is a **replacement migration**, not an additive tab — see the retirement checklist below. Nothing should read `milestones` when W-0 ships. |
| 12 | **Sub-milestones inside each major milestone** (added 2026-08-24). Major milestones are **set by the build**; sub-milestones are **fully user-editable**, and a sub may optionally carry **1–2 sub-subs**. | The sub-milestones **are** the action-plan steps — no level in between. Hierarchy: workstream → major (fixed) → sub (editable, dated, dependency-bearing) → optional sub-sub. Depth stops at sub-sub, enforced in schema. Major dates/status/progress are **derived** from subs; stage gates and objectives stay on the major; dependencies live on subs. Full detail in **Hierarchy & editability** below. |

### Hierarchy & editability (req. 12)

All settled 2026-08-24. **The action-plan steps *are* the sub-milestones** —
there is no extra level between the major milestone and the plan. A sub may
optionally carry a shallow set of children ("sub-subs"), and that is where
nesting stops.

| Level | What | Who owns it |
|---|---|---|
| 1 | **Workstream** — Overview / Financial / Technical / Approvals | **Fixed by the build.** Four values, not user-managed. |
| 2 | **Major milestone** — e.g. "Permit Approved" | **Fixed by the build.** Seeded per workstream. No add / rename / reorder / delete — **settled, and not revisitable**: see the reporting note below. Changing the canonical list is a migration, consistent with the no-admin-editor decision on action plans. |
| 3 | **Sub-milestone** = an action-plan step. Carries dates, owner + co-owner, priority order, notes, risks, dependencies. | **Fully user-editable** — add, rename, reorder, re-date, delete. |
| 4 | **Sub-sub** — optionally 1–2 children under a sub | **Fully user-editable.** Depth stops here: a sub-sub cannot have children. Enforce the cap in the schema, not just the UI. |

Settled consequences:

- **Major dates are derived, never entered.** `start` = earliest sub start,
  `end` = latest sub end; days-in-stage and est-days-remaining (req. 3) roll up
  the same way. A major with no subs yet shows no window rather than a
  hand-typed one. This means **sub-milestones must carry real start/end dates** —
  the steps in the reviewed mock did not, and they need them.
- **Status and progress roll up too.** A major is complete when its subs are;
  "at risk" propagates from the worst child, so the amber dot on a major is
  always explained by something underneath it.
- **Stage gates and key objectives stay on the major** — unchanged from the
  original spec. They are the gate *out of* that stage. Subs carry no gates.
- **Dependencies attach at the sub level** (req. 9), and may cross workstreams.
  Major-level dependencies are derived from their subs', never stored — storing
  both invites contradictions. Critical path is therefore computed over subs.
- **The fixed level-2 list is a reporting asset, not a limitation.** Because
  every project shares the same majors, R-8 can compare projects
  milestone-for-milestone across the portfolio. That only works *because* users
  can't rename them — which is why editable majors are settled as a no.

**UI impact on Option A: smaller than feared.** Because the plan *is* the sub
list, the accordion is still two expansion levels, exactly what the reviewed
mock validated — expanding a major reveals its subs, and a sub with children
discloses 1–2 nested rows inline. Keep sub-subs visually subordinate (indented,
no separate dot on the spine) so the milestone spine stays the only vertical
line on the page. The mock needs two deltas to be accurate: **dates on each
sub**, and **one example of a sub with sub-subs**.

### Milestone-retirement checklist (req. 11)

Every current consumer of the `milestones` table. All of these move to the
Workstreams model in the same change — a partial cut leaves the overview and the
projects list reporting stale data while Workstreams claims to be authoritative.

| Surface | File | What it does today |
|---|---|---|
| **Next Milestone** — project detail | [projects/[id]/page.tsx:92](src/app/(app)/projects/[id]/page.tsx:92) → [ProjectSummaryCard.tsx:239](src/components/project/ProjectSummaryCard.tsx:239) | First row where `completed` is false |
| **Next Milestone** — projects list column | [projects/page.tsx:57](src/app/(app)/projects/page.tsx:57) → [ProjectsClient.tsx:70](src/components/projects/ProjectsClient.tsx:70) | `next_milestone` + `next_milestone_date` columns |
| **Next Milestone** — project card | [ProjectCard.tsx:57](src/components/projects/ProjectCard.tsx:57) | Label only |
| **New-project seeding** | [api/projects/route.ts:4](src/app/api/projects/route.ts:4) | `DEFAULT_MILESTONES` — seeds 12 default milestone rows on every project create (Site Assessment → PTO). These 12 are the natural starting point for the default workstream templates: they already split cleanly across Financial (PPA executed), Technical (feasibility, engineering design, procurement), and Approvals (interconnection, permits). Becomes "seed the four default workstreams + their default milestones/steps," which is a **template-design decision**, not a mechanical port. |
| **Milestone write API** | [api/milestones/[id]/route.ts](src/app/api/milestones/[id]/route.ts) | Update/complete a milestone; writes **no** activity (this is R-1's gap) |
| **Schedule tab** | [ScheduleTab.tsx](src/components/project/ScheduleTab.tsx) | Renders milestones; already hidden. Delete with W-0. |
| **Types** | [database.ts](src/types/database.ts) | `milestones` row types |

Open call: **drop the `milestones` table or leave it dormant.** Recommend
leaving the table in place (unread) for one release so the data is recoverable if
the Workstreams import gets something wrong, then dropping it in a follow-up
migration.

### Known dependencies & constraints

- **Nothing from the `schedule-tab` branch carries forward.** It holds the old
  Phase 1a milestones + `show_on_schedule` opt-in code and its migrations are
  numbered **022/023, colliding with `main`'s**. Delete candidate — never merge.
- Net-new schema required. Next free migration number: **053** — note 053 is
  already written but not yet run, so Workstreams starts at **054+**.
- **R-8 (Reports) is the downstream consumer.** Design the fields for it now
  (requirements 8–9) rather than retrofitting. Dependencies are v1, so the
  critical-path data exists from day one even though the Reports UI comes later.
- **W-0 blocks R-1.** R-1's whole content is "log milestone changes to
  `activity_log`," and the route it would patch
  (`src/app/api/milestones/[id]/route.ts`) is being **deleted** by req. 11. Build
  the activity logging into the Workstreams write paths as part of W-0 and R-1
  closes with it; patching the old route first is throwaway work.
- The tab replaces "Schedule" in `TABS`
  ([ProjectDetailClient.tsx:29](src/components/project/ProjectDetailClient.tsx:29)),
  which is commented out. An existing
  [ScheduleTab.tsx](src/components/project/ScheduleTab.tsx) still renders
  milestones and is wired at line 130 — replace or retire it as part of W-0.

---

## Session hygiene

- One session = one coherent feature/bug. Start fresh between unrelated work.
- Durable "how we work" facts → [CLAUDE.md](CLAUDE.md); roadmap → here; shipped history → [CHANGELOG.md](CHANGELOG.md).
- Update this file + give an end-of-session summary (table format) at the close of each session.
- Don't commit/push without an explicit request.
