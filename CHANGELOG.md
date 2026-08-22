# Pathwaze — Changelog

> Human-readable record of what shipped, newest first. Git history has the
> full detail; this is the "what changed for users" summary. Add an entry
> whenever a user-facing feature or notable fix lands on `main`.

---

## 2026-08-21

- **What's New release notes** — a `/whats-new` page carries the full release
  note (per-section detail plus step-by-step "How to" guides for drawing review
  and connecting Outlook), and a modal surfaces a summary of it once per user on
  their next page load after a release ships. Dismissing it — or clicking through
  to the full note — stamps `users.whats_new_seen` with the release key, so it
  never re-nags. Reachable any time from the avatar menu. Shipping the next
  update is a content-only change: rewrite `RELEASE` in `src/lib/whats-new.ts`
  and bump `RELEASE.key`. (Migration 053 — run required.)
- **Project Tasks tab** — the project detail page has a **Tasks** tab (second,
  right after Threads) listing that project's tasks grouped by status, with
  priority dot, type chip, due date (overdue in red), and assignee. Completed
  tasks are hidden behind a "Show completed" toggle; a row opens that task's
  drawer, and "Open in Task Tracker" jumps to `/tasks` pre-filtered to the
  project. No migration.
- **Outlook email → project Threads** — stakeholder emails now flow into the
  project Threads tab, CRM-style. Each user connects their own mailbox once from
  Settings → "Email (Outlook)" (Microsoft SSO, **read-only**); mail whose sender
  or recipient matches a `stakeholders.email` is mirrored to that stakeholder's
  project. Covers the whole mailbox (Inbox, Sent, and filed mail) over the last
  12 months, backfilled oldest-first in chunks so a large mailbox can't time out,
  and kept current by a daily cron. (Migrations 049 + 050 — run required.)
- **Threads reorganization** — the Threads tab is now one unified feed across
  Slack messages, emails, and notes instead of a Slack-only mirror. Adds a search
  box, sorting (newest first by default, plus by date/author), and collapsed
  emails and Slack messages that expand on click so a long thread stays readable.
  Slack formatting (bold, bullets, mrkdwn) renders properly, and file attachments
  are clickable.
- **Note / Task / File composer on Threads** — the composer that was already on
  every other project tab now works on Threads too, so you can capture a note or
  spin off a task without leaving the conversation.
- **Per-tab activity feeds** — each project tab's activity feed now shows only
  what happened on that tab: Site = buildings/parcels/site info, Utility =
  meters/accounts, Technical = systems/specs, Drawings = as-builts and their
  status. Project field edits (including **stage** and **deal health**) are now
  logged, so the history is there for portfolio reporting.
- **Deep-linked activity** — entity names in the activity feed and the
  notification bell are now links. Clicking "…updated a meter" jumps to that
  exact record, scrolls to it, highlights it, and **opens its detail drawer**
  (meters, buildings, permits, systems, and offtaker pricing; Drawings scrolls
  and highlights, since it opens a full review view rather than a drawer).
- **Auto design revisions on Systems** — `design_rev` now bumps itself, with a
  date, whenever a design-defining field changes (sizes, yield, system type,
  module/inverter counts and ratings, design URL, linked areas). Cosmetic edits
  like renaming or changing status don't bump it. The old hand-typed version box
  is gone — the field is read-only, and doubles as a last-modified marker.
- **Site Plan records** — a site plan PDF is uploaded in the **Drawings** tab as
  its own drawing type and linked to one or more systems; the Technical tab shows
  a read-only table of the current plan. A new site-plan revision bumps the
  revision on every system it's linked to. (Migration 052 — run required.)

## 2026-08-20

- **Meter usage-dataset fields** — meters now record how their usage data was
  captured: **Data Type** (Annual Bills, Interval Data 30-min, Interval Data
  60-min), **Billing Start Year**, and **Billing Start Month**. (Migration 051 —
  run required.)
- **Permitting data load** — 99 Permit Scout permit records loaded across 16
  AdventHealth projects (7 previously curated rows preserved). The
  extract/preview/load scripts are committed under `scripts/` for reuse.

## 2026-08-19

- **Docs** — consolidated project documentation to four living files
  (`README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md`); older `HANDOFF.md`,
  `BACKLOG.md`, and `DRAWINGS_AND_RFI_PLAN.md` moved to `docs/archive/` as
  historical reference.

## 2026-07-15

- **Saved filter presets** — Projects and Tasks lists can now save the current
  filters as a named preset and re-apply it in one click (presets are per-user
  and sync across devices). (Migration 046 — run required.)
- **RFI sort & assignee filter** — the RFIs list can filter by who the ball is
  in court with, and sort by most recent, due date, days open, or RFI number.
- **RFI attachments** — files can now be attached directly to an RFI (not just
  to a response), with upload/open/remove on the RFI detail. (Migration 047 —
  run required.)
- **Drawing review comments** — the review module now has a free-form comments
  section for notes beyond the structured action-plan questions (author-only
  delete). (Migration 048 — run required.)
- **Subtasks** — tasks can now have subtasks (one level deep). The task drawer
  has a Subtasks section with a progress bar, inline add, and click-through to
  each subtask (subtasks are full tasks with their own assignee/status/due).
  The task list + kanban show a `done/total` chip on parents; subtasks are
  hidden from the top-level views. (Migration 045 — run required.)
- **Task quick-reassign** — reassign a task straight from the drawer without
  entering edit mode (fires the usual assignment notifications).
- **Project Contact link** — the main contact on a project now shows just the
  name and links straight to the Stakeholders tab.
- **Bigger drawing uploads** — the Drawings tool now accepts files up to 200 MB
  (migration 044 — run required).
- **Slack fix** — `/pathwaze <project>` no longer times out (the lookup was
  doing too many sequential queries).

## 2026-06-11

- **RFI status notifications** — closing or (re)opening an RFI now emails the
  ball-in-court + distribution list; official responses are distinguished from
  ordinary ones ("Official response posted", and "…& RFI closed" when an
  official response closes it).
- **Dashboard — Your RFIs** — the "Your conversations" card now also lists RFIs
  you're involved in (ball-in-court, RFI manager, received-from, or on the
  distribution), with an overdue flag.
- **In-app prompts** — replaced the browser `window.prompt()` box everywhere
  (drawing rename, add-stakeholder, task change-request notes, rich-text link)
  with a branded in-app dialog (`usePrompt`).
- **"Delegate to Assignee"** — drawing-review delegate modal renamed from
  "Delegate to Engineer."
- **Dev** — `EMAIL_NOTIFY_SELF=true` lets you receive your own task emails for
  solo testing (mirrors `SLACK_DM_SELF`).

## 2026-06-09

- **As-Built Drawings** — new **Drawings** tab on every project. Drawings are
  organized into **collections** (named, owned "drawing types" — As-Builts ships
  seeded; add your own with an owner and a review type). Upload a drawing, link it
  to an **area** (a Site-tab building row) + a **discipline**, and it gets a
  **review** against that type's seeded **action plan**: the Universal questions
  (synced across the area+type "set", with per-drawing override) plus the
  discipline checklist. Each item takes a disposition (Confirmed / Field-Verify /
  Unknown / Conflict / Risk), finding, sheet ref, and Survey SOW action, with a
  live progress bar and inline **View PDF**.
- **Delegate / Create RFI** — from any finding, **Delegate** spins up an
  Engineering task (linked to the building) or **Create RFI** opens a formal
  request; the finding then shows a chip linking to the task/RFI.
- **RFIs** — new master-nav module modeled on Procore: portfolio log with
  status/overdue filters, **per-project numbering (#001…)**, ball-in-court,
  collapsible details, **linkages** (area / system / meter / stakeholder /
  drawing), **Received From** (internal user or stakeholder, with inline add),
  edit-any-time, and a responses thread with **rich text, file attachments, and
  @-mentions**.
- **Notifications** — branded emails (matching the invite template) + Slack DMs +
  in-app feed for: task delegated, RFI created / responded / @-mention, **Risk
  findings escalated to admins**, and a daily **overdue-RFI reminder** (Vercel
  cron). All notification emails now share the branded shell.
- **Platform** — `/tasks?id=` and notification links now open the **specific
  task**; `RichTextEditor` gains a **link** button and **@-mention** autocomplete.
- **Under the hood** — migrations **032–041**; new Storage buckets `drawings` and
  `rfi-files`; service-client `no-store` fix (Next was caching cron query results).

## 2026-05-26

- **Domain cutover** — production now lives at `https://pathwaze.esa-solar.com`
  (was `pathwaze.vercel.app`, which now redirects). Supabase auth URLs,
  Vercel `NEXT_PUBLIC_APP_URL`, and Slack event URL updated. Code fallbacks
  point at the new domain.
- **Docs** — `CLAUDE.md` refreshed (schema, roles, routes, conventions);
  added `BACKLOG.md` + this `CHANGELOG.md`.

## 2026-05-23

- **Build fix** — restored helper components accidentally cut during the
  rich-text refactor; cleared all lint warnings.

## 2026-05-22

- **Rich text everywhere** — task descriptions, project notes/events, and
  Buildings/Permits notes now use a bold / bulleted / numbered editor.
  Shared `RichTextEditor` + `NotesRender` primitives.
- **Slack mentions render properly** — `<@USERID>` tokens from synced Slack
  messages now show as `@FirstName` badges across all thread views.
- **Task file uploads fixed** — added the missing RLS policies on
  `task_files` (uploads were silently rejected).

## 2026-05-21

- **Offtaker Pricing** (Financial tab) — new versioned proposal-options table
  replacing the old single-row Transaction Structure. Each row is an Option
  (A/B/C) with its own contract terms, per-meter utility savings calcs,
  environmental attributes, notes, and a threaded discussion. Internal
  version counter (v1/v2/v3) increments on edit and logs field-level changes
  to the project activity feed. One row can be marked Selected. Contract
  Type + Offtaker Credit moved to Tax & Incentives.
- **Manager role** — new role between team and admin. Sees + edits
  everything but cannot archive/delete projects (admin-only).
- **Archive hide-by-default** — archived projects vanish from all lists;
  admins manage them at `/admin/archived`.
- **Task visibility** — Public/Private toggle on tasks (private = personal
  reminder, only creator sees it).
- **Task-type subscriptions** — team users see public tasks of the types
  they subscribe to (Settings page), plus anything they're directly on.
- **New-task modal** — compact visibility toggle; Related-entity + file
  attachment sections added at creation time.

## 2026-05-20

- **Task email notifications** (Resend) — email on task assignment + on
  completion (to the creator). Per-user opt-out in Settings.
- **Task UX** — click-through to project from any task; duplicate task
  (pre-filled modal); link related entities (building/meter/system/permit/
  stakeholder) with click-to-navigate.
- **Invite email logo** — long saga resolved; invite emails now render the
  Pathwaze logo reliably (static PNG at `/email-logo.png`, middleware-exempt).
- **Dashboard fixes** — tasks-due-this-week filter, conversations source
  (now reads project_threads), and active-projects mapping all corrected.

## 2026-05-19

- **Project detail UI** — unified tab bar + content into one card surface;
  aligned all sections to a consistent max width; global font scale bump;
  refined tab styling (blue active underline).

## Earlier (pre-changelog)

- Google Maps address autocomplete on address fields.
- Slack integration: channel linking, DM notifications, profile sync,
  thread mirroring.
- Core build: projects, site assets (buildings/meters/systems), permits,
  stakeholders, tasks, dataroom, financials, dashboard, investor portal,
  user management + invites.
