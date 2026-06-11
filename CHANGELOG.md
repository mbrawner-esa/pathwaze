# Pathwaze — Changelog

> Human-readable record of what shipped, newest first. Git history has the
> full detail; this is the "what changed for users" summary. Add an entry
> whenever a user-facing feature or notable fix lands on `main`.

---

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
