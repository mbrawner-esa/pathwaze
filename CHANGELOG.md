# Pathwaze — Changelog

> Human-readable record of what shipped, newest first. Git history has the
> full detail; this is the "what changed for users" summary. Add an entry
> whenever a user-facing feature or notable fix lands on `main`.

---

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
