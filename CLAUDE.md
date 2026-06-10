# Pathwaze — Project Context

## What this is
Pathwaze is a Next.js 14 project management and CRM for ESA Solar managing 19 AdventHealth BTM solar projects across Florida and Illinois.

## Stack
- Next.js 14 App Router, TypeScript
- Supabase (Postgres + RLS + Auth)
- Tailwind CSS + shadcn/ui
- Vercel deployment
- Box SDK (dataroom), Resend (email)

## Brand Colors
- Navy: #2F3E50 (nav, headings, primary buttons)
- Gold: #E6C87A (accents, active states, CTA)
- Dark Gold: #C8963A (text on gold, hover)
- Slate: #6E879E (secondary text)
- Light Gray: #F1F5F9 (card backgrounds)

## Logo & Branding — Update Protocol

The Pathwaze logo appears in **four distinct places**. When the user says
"update the logo" (or anything semantically equivalent — new colors, new icon,
new wordmark, new lockup, new favicon), update **ALL FOUR** in the same change.
Never update one in isolation; the visual brand must stay consistent across
app UI, browser tabs, iOS home screen, and email.

### The four locations:

1. **`src/components/ui/PathwazeLogo.tsx`** — Source of truth for the brand mark.
   Inline SVG React component exporting `<PathwazeIcon>` (icon only) and
   `<PathwazeLogo>` (icon + wordmark lockup). Used in NavBar, login page,
   pending page, and anywhere else in the app UI. Has `light` and `dark`
   variants. Colors live in the `COLORS` constant at the top of the file.

2. **`src/app/icon.png`** — 32×32 favicon. Next.js App Router metadata file —
   automatically serves as the browser tab icon. Must be a raster PNG.

3. **`src/app/apple-icon.png`** — 256×256 iOS home screen icon. Next.js App
   Router metadata file. Must be a raster PNG.

4. **`public/email-logo.png`** — Pre-rendered icon+wordmark lockup (600×150
   PNG, dark variant for navy email header) used by the invite email
   template (`src/lib/email.ts`). To regenerate after a logo change:
   `curl -s -o public/email-logo.png https://pathwaze.esa-solar.com/email-logo`
   (this fetches a fresh render from the edge route below).

5. **`src/app/email-logo/route.tsx`** — Edge route that rasterizes the full
   icon+wordmark lockup to PNG via `next/og`'s `ImageResponse`. Used to
   regenerate `public/email-logo.png` after a logo change. Duplicates the
   SVG markup and `COLORS` from `PathwazeLogo.tsx` — when the source SVG
   changes, copy the new paths/colors here too.

### When updating:

- If only colors change: update `COLORS` in both `PathwazeLogo.tsx` and
  `email-logo/route.tsx`. Regenerate `icon.png` + `apple-icon.png` if the
  user provides new raster files (or note that they need to be regenerated).
- If geometry/paths change: update the SVG `<line>`/`<path>`/`<circle>` markup
  in both `PathwazeLogo.tsx` and `email-logo/route.tsx`. Regenerate the
  PNGs.
- If the wordmark changes: update `WORDMARK_GLYPHS` in both files.
- If the user provides new PNG files, ask where they want them placed and
  ensure the icon.png/apple-icon.png get replaced with appropriately sized
  versions (32×32 and 256×256 respectively).

The email template also pulls `appUrl` from the `NEXT_PUBLIC_APP_URL` env
var (set in Vercel) — no code change needed when domain changes.

## DB Schema (current)
Core: projects, project_financials, milestones, project_threads, project_notes,
activity_log, users, invited_emails, investor_access.
Site assets: buildings, meters, systems, permits, stakeholders, dataroom_docs.
Tasks: tasks, task_threads, task_files, task_links, stakeholder_tasks.
Pricing: offtaker_pricing, offtaker_pricing_threads.
Drawings: drawing_collections (named, owned "drawing types"), action_plans /
action_plan_sections / action_plan_items (review-checklist templates; the
As-Built plan is seeded), drawings (linked to a collection + area/building +
discipline), drawing_reviews (one per drawing), review_findings (disposition,
finding, sheet_ref, sow_action, delegated_task_id, rfi_id, is_override),
set_universal_findings (Universal answers shared per area+collection "set").
RFIs: rfis (per-project numbered), rfi_responses, rfi_distribution, rfi_links
(polymorphic), rfi_response_files.

See `supabase/migrations/` for the canonical schema — each migration is
numbered (001…041+) and is idempotent (CREATE/ALTER … IF NOT EXISTS).
Storage buckets: task-files, project-files, drawings, rfi-files.

## Roles
- **admin** — full access, only role that can archive or delete projects
- **manager** — sees + edits everything; cannot archive/delete projects
- **team** — sees all projects; tasks gated by visibility + task-type subscriptions
- **investor** — investor portal only

Permission helpers live in `src/lib/permissions.ts`. Use them in BOTH UI and
server route handlers (defense in depth).

## Routes
- /auth/login — login
- /auth/pending — pending-approval landing
- /dashboard — portfolio KPIs + tasks-due + recent threads + active projects
- /projects — project list with filters (archived projects hidden by default)
- /projects/[id] — project detail (Threads / Site / Utility / Stakeholders /
  Permitting / Technical / Financial tabs; tab is honored via ?tab=)
  (project detail also has a **Drawings** tab: drawing collections → upload →
  link area+discipline → per-drawing review against the action plan → findings →
  Delegate to a task / Create RFI)
- /tasks — task list + kanban; visibility + task-type subscription filters.
  `?id=<taskId>` deep-links and opens that task's drawer.
- /rfis — Procore-style RFI log (master nav); /rfis/[id] — RFI detail
  (ball-in-court, linkages, responses, official-response-closes)
- /stakeholders — CRM directory
- /dataroom — health dashboard
- /settings — profile + notification prefs + task subscriptions
- /admin/users — invite + manage users (admin only)
- /admin/archived — view + restore + delete archived projects (admin only)
- /investor/[token] — investor read-only portal
- /email-logo — edge route that rasterizes the lockup PNG for emails (public)
- /api/cron/rfi-reminders — daily Vercel cron; DMs/emails the ball-in-court on
  overdue open RFIs. Gated by `CRON_SECRET` (Vercel sends it as a Bearer header);
  supports `?dry=1`. Uses a **service-role** client with `cache: 'no-store'`
  (Next.js was caching the PostgREST GET → stale/empty results).

## Conventions
- All DB queries via Supabase client
- Server components for initial data fetch, client components for interactivity
- RLS enforces access — never filter by role in application code alone
- Financial tab is read-only by default; Edit button toggles edit mode
- Notes / Description / threaded message inputs across the app share two UI primitives:
  - `src/components/ui/RichTextEditor.tsx` — bold / bulleted / numbered toolbar
  - `src/components/ui/NotesRender.tsx`    — renders HTML notes + legacy plain-text fallback
  Anywhere a new notes/description box is added, use these — don't introduce a fresh textarea.
- Slack-style mentions / channel refs / URLs in thread messages render via
  `src/components/ui/MessageText.tsx`. Pass the active users list so `<@USERID>`
  tokens resolve to display names.
- **Two mention systems coexist** (don't conflate): (a) Slack `<@USERID>` tokens
  in thread/comment composers, rendered by `MessageText`; (b) `RichTextEditor`
  `@`-autocomplete (pass `mentionUsers`) which inserts
  `<span class="mention" data-uid="…">` — used in RFI responses + task/notes
  editors. Parse the latter with `parseMentions()` to notify.
- **Notifications**: emails go through the shared branded shell in
  `src/lib/email.ts` (`sendNotificationEmail` — same shell as invite/task emails;
  keep all new notification emails on it). Slack DMs + activity-feed +
  email helpers for RFIs/mentions/risk live in `src/lib/rfi-notify.ts`
  (`logActivity`, `parseMentions`, `emailUser`, `emailStakeholder`); the
  canonical activity logger is `src/lib/activity.ts`. The in-app bell reads the
  global recent `activity_log` feed (not per-user inboxes) — targeted notice is
  the email/Slack DM.
- **Drawings/RFIs**: a drawing belongs to a `drawing_collection` (drawing type)
  and is reviewed against that collection's `action_plan`. Universal questions
  sync across the area+collection "set" via `set_universal_findings` (per-drawing
  override = a `review_findings` row with `is_override`). A finding can Delegate
  (→ Engineering task, `delegated_task_id`) or Create RFI (`rfi_id`).

## Team
- Morgan Brawner (admin): MB, #2F3E50
- Sarah Chen (team): SC, #6E879E
- James Wright (team): JW, #E6C87A

## Workflow preferences
- **End-of-day summary**: at the close of any working session, produce an EOD
  summary in table format covering (a) what shipped today (commits +
  migrations + features), (b) what's in flight or unblocked, (c) anything
  that needs the user's manual action (Supabase SQL, Vercel env vars,
  IT request, etc.).
- **Default to table format** when listing tasks, status, or comparisons.
- **No commits without user request**. Always ask before pushing.
