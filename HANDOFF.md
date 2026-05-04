# Pathwaze — Claude Code Handoff Document
*Last updated: 2026-05-04 | Commit: a170fd2*

---

## What Is Pathwaze

Pathwaze is a Next.js 14 project management and CRM web application for **ESA Solar**, managing **19 AdventHealth BTM solar projects** across Florida and Illinois in 5 investment tranches (~49.5 MWdc, ~$97.4M total capital).

**Live URL:** https://pathwaze-5idg1ybt7-mbrawner-esas-projects.vercel.app  
**GitHub:** https://github.com/mbrawner-esa/pathwaze  
**Local path:** `C:\Users\Morgan Brawner\Box\Morgan Brawner\Pathwaze`

> ⚠️ **Important:** `node_modules` cannot be installed locally — Box Drive locks files during sync. All builds happen on Vercel. Do not run `npm install` or `next build` locally. Push to GitHub and let Vercel build.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.35, App Router, TypeScript |
| Database + Auth | Supabase (Postgres + RLS + Auth) |
| Styling | Tailwind CSS, custom design system |
| Hosting | Vercel (auto-deploys on push to `main`) |
| Integrations | Box SDK (stub), Resend (stub) |

---

## Brand / Design System

| Name | Hex | Usage |
|---|---|---|
| Navy | `#2F3E50` | Nav, headings, primary buttons |
| Gold | `#E6C87A` | Accents, CTA text on navy buttons |
| Dark Gold | `#C8963A` | Text on gold, hover states |
| Slate | `#6E879E` | Secondary text, labels |
| Light Gray | `#F1F5F9` | Card backgrounds, table headers |

- **Primary button:** `bg-[#2F3E50] text-[#E6C87A]`
- **Secondary button:** `btn-secondary` class (white bg, navy border/text)
- **Labels:** `.label` class — 10.5px, uppercase, `#94a3b8`
- **Cards:** `.card` class — white bg, `border-radius: 12px`, subtle shadow

---

## Repository Structure

```
src/
├── app/
│   ├── (app)/                        # Route group — requires auth
│   │   ├── layout.tsx                # AppLayout wrapper (NavBar)
│   │   ├── dashboard/page.tsx        # Portfolio KPIs, pipeline chart, activity feed
│   │   ├── projects/
│   │   │   ├── page.tsx              # Projects list (fetches + maps data)
│   │   │   └── [id]/page.tsx         # Project detail (all 8 tabs)
│   │   ├── tasks/page.tsx            # Tasks list + kanban
│   │   ├── stakeholders/page.tsx     # Global stakeholder CRM
│   │   └── dataroom/page.tsx         # Portfolio dataroom health dashboard
│   ├── api/
│   │   ├── auth/callback/route.ts    # Supabase auth callback
│   │   ├── projects/
│   │   │   ├── route.ts              # POST — create project
│   │   │   └── [id]/financials/route.ts  # PATCH — update financials
│   │   ├── tasks/
│   │   │   ├── route.ts              # POST — create task
│   │   │   └── [id]/
│   │   │       ├── route.ts          # PATCH/DELETE — update/delete task
│   │   │       └── comments/route.ts # GET/POST — task thread comments
│   │   ├── stakeholders/
│   │   │   ├── route.ts              # POST — create stakeholder
│   │   │   └── [id]/route.ts         # PATCH/DELETE — update/delete stakeholder
│   │   ├── milestones/
│   │   │   └── [id]/route.ts         # PATCH — toggle milestone complete
│   │   └── box/upload/route.ts       # STUB — Box file upload
│   ├── auth/login/page.tsx           # Login page
│   └── page.tsx                      # Root redirect → /dashboard
├── components/
│   ├── layout/
│   │   ├── NavBar.tsx                # Top nav — links, user menu, logout
│   │   └── AppLayout.tsx             # Wrapper with NavBar
│   ├── dashboard/
│   │   ├── PipelineChart.tsx         # Recharts bar chart by stage
│   │   └── ActivityFeed.tsx          # Recent activity_log entries
│   ├── projects/
│   │   ├── ProjectsClient.tsx        # Search, filter, group-by, New Project modal
│   │   └── ProjectCard.tsx           # Project card with stage/health badges
│   ├── project/                      # Project detail tab components
│   │   ├── ProjectDetailClient.tsx   # Tab switcher, header
│   │   ├── SiteTab.tsx               # Address, map embed, facility info
│   │   ├── UtilityTab.tsx            # Utility, interconnection info
│   │   ├── StakeholdersTab.tsx       # Per-project stakeholder table
│   │   ├── PermittingTab.tsx         # AHJ, permits table
│   │   ├── TechnicalTab.tsx          # System specs, equipment
│   │   ├── FinancialTab.tsx          # Cost breakdown, read/edit toggle
│   │   ├── ScheduleTab.tsx           # Milestone timeline, toggle complete
│   │   └── DataRoomTab.tsx           # Per-project DR categories + upload stub
│   ├── tasks/
│   │   └── TasksClient.tsx           # List/kanban, New Task modal, detail panel + comments
│   ├── stakeholders/
│   │   └── StakeholdersClient.tsx    # Table, group-by, New Stakeholder modal, detail panel
│   ├── dataroom/
│   │   └── DataroomClient.tsx        # Portfolio completion donut charts, matrix table
│   └── ui/
│       ├── Avatar.tsx                # Initials circle avatar
│       ├── StageBadge.tsx            # Colored stage pill
│       └── DealHealthBadge.tsx       # On Track / At Risk / Delayed badge
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   └── server.ts                 # Server Supabase client (cookies)
│   └── utils.ts                      # formatCurrency, formatDate, cn()
├── middleware.ts                      # Auth guard — uses getSession (not getUser)
└── types/database.ts                  # TypeScript types for all DB tables
```

---

## Database Schema (Supabase)

Migration file: `supabase/migrations/001_initial_schema.sql`

| Table | Key Fields |
|---|---|
| `projects` | id, project_number, name, customer, stage, deal_health, system_kwdc, system_kwac, address, city, state, zip, lat, lng, utility, rate_schedule, tranche, assignee_id (FK users), facility_type, target_cod, ... |
| `project_financials` | id, project_id (UNIQUE FK), total_cost, itc_eligible_costs, estimated_epc_cost, estimated_dev_costs, estimated_ix_costs, development_fee, itc_rate, contract_type, year1_contract_price, escalation_rate, yield_kwh_kwp, ... |
| `milestones` | id, project_id, label, target_date, completed, completed_at, sort_order |
| `tasks` | id, project_id, title, description, type, status, priority, assignee_id, approver_id, requires_approval, approval_status, approval_notes, due_date |
| `task_threads` | id, task_id, user_id, message, created_at |
| `stakeholders` | id, project_id (nullable = global), name, title, department, role, email, phone, sentiment, is_primary, org |
| `stakeholder_tasks` | id, stakeholder_id, text, done |
| `stakeholder_feed` | id, stakeholder_id, type, date, user_name, text, subject |
| `dataroom_docs` | id, project_id, category_id, subcategory_id, doc_name, status, box_file_id, file_name, uploaded_by, uploaded_at |
| `users` | id (from Supabase auth), email, full_name, role (admin/team/investor), avatar_url |
| `activity_log` | id, entity_type, entity_id, action, user_id, metadata (jsonb), created_at |
| `permits` | id, project_id, name, category, level, status, ahj, submitted_at, approved_at, notes |
| `investor_access` | (for investor magic link portal) |

**Task statuses:** Draft → Ready to Start → In Progress → Under Review → Pending Info → Complete  
**Task types:** Design, Engineering, Permitting, Interconnection, Financial, Legal, Construction, Operations, Administrative  
**Priorities:** High, Medium, Low  
**Stakeholder sentiments:** Supportive, Neutral, Concerned, Opposed

---

## Seed Data

All 19 projects, 45 stakeholders, 23 tasks, milestones, and DR_CATEGORIES are embedded in the HTML prototype at:
`C:\Users\Morgan Brawner\AppData\Local\Temp\btm-solar-pm.html`

The seed script is at `supabase/seed.ts` — **has not been run yet against the live Supabase instance.** Projects and other data must be entered manually or by running the seed script.

---

## Environment Variables

Stored in `.env.local` (gitignored) and in Vercel project settings.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `BOX_CLIENT_ID` | Box app client ID (not yet configured) |
| `BOX_CLIENT_SECRET` | Box app secret (not yet configured) |
| `BOX_ENTERPRISE_ID` | Box enterprise ID (not yet configured) |
| `RESEND_API_KEY` | Resend email API key (not yet configured) |
| `NEXT_PUBLIC_APP_URL` | Full deployment URL |

---

## Team / Users

| Name | Initials | Color | Role |
|---|---|---|---|
| Morgan Brawner | MB | `#2F3E50` | Admin |
| Sarah Chen | SC | `#6E879E` | Team |
| James Wright | JW | `#E6C87A` | Team |

Users must be created in **Supabase → Authentication → Users** AND have a matching row in the `users` table with their auth UUID as the `id`.

---

## What's Built ✅

| Feature | Status |
|---|---|
| Auth — email/password login, middleware route protection | ✅ |
| Dashboard — KPIs, pipeline chart (Recharts), activity feed | ✅ |
| Projects list — search, filter (stage/state/assignee), group-by (tranche/stage/state) | ✅ |
| New Project modal — creates project + 12 default milestones + financials row | ✅ |
| Project detail — all 8 tabs render with live Supabase data | ✅ |
| Financial tab — read-only view + Edit mode saves to DB | ✅ |
| Schedule tab — milestone timeline, click to toggle complete/incomplete | ✅ |
| Tasks — list view + kanban layout, search, filters | ✅ |
| New Task modal — project, title, type, priority, assignee, due date, approval | ✅ |
| Task detail panel — clickable status stepper, threaded comments, approve/reject | ✅ |
| Stakeholders — table with search, filter, group-by | ✅ |
| New Stakeholder modal — all fields, project assignment | ✅ |
| Stakeholder detail panel — contact info, delete | ✅ |
| Dataroom dashboard — portfolio completion donuts, project matrix table | ✅ |
| NavBar — links, active highlighting, user menu, logout | ✅ |

---

## What's Not Built Yet ❌

### Priority 1 — High Impact
| Feature | Where | Notes |
|---|---|---|
| **Seed script execution** | `supabase/seed.ts` | All 19 projects are in btm-solar-pm.html; seed hasn't been run |
| **Dataroom file upload** | `DataRoomTab.tsx`, `/api/box/upload/route.ts` | Upload button is a stub; needs Box JWT auth + SDK wired up |
| **Stakeholder task checklist** | `StakeholdersTab.tsx` | Per-stakeholder mini todo list (stakeholder_tasks table exists) |
| **Stakeholder activity feed** | `StakeholdersTab.tsx` | Notes/comments/emails per stakeholder (stakeholder_feed table exists) |
| **Permit detail panel** | `PermittingTab.tsx` | Click permit → side panel with tasks + activity |

### Priority 2 — Medium Impact
| Feature | Where | Notes |
|---|---|---|
| **Site tab — Buildings/Areas table** | `SiteTab.tsx` | Add/view buildings/parcels linked to project |
| **Utility tab — Meters table** | `UtilityTab.tsx` | Add/view meters with usage, linked to buildings |
| **Technical tab — Systems table** | `TechnicalTab.tsx` | Add systems, track design versions, baseline comparison |
| **Add Stakeholder from project tab** | `StakeholdersTab.tsx` | Currently read-only; needs inline Add Stakeholder |
| **Task edit** | `TasksClient.tsx` | Task detail panel is view+status-only; no field editing |
| **Kanban drag-drop** | `TasksClient.tsx` | Cards are draggable-looking but no drag handlers |

### Priority 3 — Integrations
| Feature | Notes |
|---|---|
| **Box API** | JWT server-side auth, folder-per-project structure, file upload/download |
| **Resend emails** | Task assigned, approval requested, investor invite magic link, weekly digest |
| **Investor portal** | `/investor/[token]` read-only view — route exists but not built |
| **Notification bell** | NavBar bell icon is visual only |

---

## Known Issues / Gotchas

1. **`node_modules` cannot be installed locally** — Box Drive sync locks files. Never run `npm install` in the project directory. All builds go through Vercel.

2. **Middleware uses `getSession()` not `getUser()`** — This is intentional. `getUser()` makes a Supabase network call on every page load, causing `MIDDLEWARE_INVOCATION_TIMEOUT`. `getSession()` reads the JWT locally. Individual API routes use `getUser()` for server-side verification.

3. **API routes excluded from middleware matcher** — The matcher pattern excludes `/api/` routes. Each API route verifies auth itself.

4. **Supabase TypeScript types** — Some Supabase table updates require `as any` cast due to strict generated types. See `milestones/[id]/route.ts` for example.

5. **Seed data not loaded** — The 19 AdventHealth projects exist in the HTML prototype and seed.ts but haven't been inserted into the live Supabase instance. Projects must be added manually via the New Project modal or by running the seed script.

6. **Git safe.directory** — Box Drive folder ownership triggers a git safety warning. Already resolved with `git config --global --add safe.directory 'C:/Users/Morgan Brawner/Box/Morgan Brawner/Pathwaze'`.

---

## Development Workflow

Since `node_modules` can't live locally, all iteration follows this pattern:

```bash
# 1. Edit files in src/ using Claude Code or any editor
# 2. Stage and commit
git add <files>
git commit -m "Description of change"
# 3. Push — Vercel auto-deploys in ~2 minutes
git push
# 4. Check Vercel deployment logs if build fails
```

**Vercel project:** https://vercel.com/mbrawner-esas-projects/pathwaze  
Check build logs there for TypeScript errors before they hit production.

---

## Dataroom Categories (DR_CATEGORIES)

7 categories used across all projects for the dataroom:

| # | Category | Key Documents |
|---|---|---|
| 0 | Legal Entity | W-9, EIN, Articles of Incorporation, Good Standing |
| 1 | Real Estate | LOI, Lease, Title Report, ALTA Survey, KMZ |
| 2 | Engineering | IE Report, Single Line Diagram, Helioscope, PVSyst, Structural |
| 3 | Permitting | Zoning, Building Permit, Electrical Permit, Environmental |
| 4 | Interconnection | Pre-App Results, IX Application, Conditional Approval, IX Agreement |
| 5 | Construction | EPC Contract, Module Supply, Payment Bonds, Roof Contractor |
| 6 | Financial | Financial Model, O&M Proposal, Tax Equity Term Sheet |

The full document list per category is hardcoded in `DataroomClient.tsx` and `DataRoomTab.tsx`.

---

## Tranche Summary

| Tranche | # Projects | State | Contract | Notes |
|---|---|---|---|---|
| TR01 - GLR | 5 | IL | PPA | ComEd utility, REC arbitrage |
| TR02 - WFD | 4 | FL | ESA | Duke/TECO/WREC utilities |
| TR03 - CFD | 4 | FL | ESA | Duke Energy, partial financial data |
| TR04 - EFD | 5 | FL | ESA | Duke/FPL/SECO utilities |
| TR05 - CORP | 1 | FL | ESA | Distribution Center, rooftop |
