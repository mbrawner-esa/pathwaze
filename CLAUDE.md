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

4. **`src/app/email-logo/route.tsx`** — Edge route that rasterizes the full
   icon+wordmark lockup to PNG via `next/og`'s `ImageResponse`. Referenced by
   the invite email template (`src/lib/email.ts`) as `${appUrl}/email-logo`.
   Currently duplicates the SVG markup and `COLORS` from `PathwazeLogo.tsx` —
   when the source SVG changes, copy the new paths/colors here too.

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

## DB Schema
12 tables: projects, project_financials, milestones, tasks, task_threads, stakeholders, stakeholder_tasks, stakeholder_feed, dataroom_docs, users, activity_log, permits, investor_access

## Routes
- /auth/login — login page
- /dashboard — portfolio KPIs
- /projects — project list with filters
- /projects/[id] — project detail (8 tabs)
- /tasks — task list/kanban
- /stakeholders — CRM directory
- /dataroom — dataroom health dashboard
- /investor/[token] — investor read-only portal

## Conventions
- All DB queries via Supabase client
- Server components for initial data fetch, client components for interactivity
- RLS enforces access — never filter by role in application code alone
- Financial tab is read-only by default; Edit button toggles edit mode

## Team
- Morgan Brawner (admin): MB, #2F3E50
- Sarah Chen (team): SC, #6E879E
- James Wright (team): JW, #E6C87A
