# Drawings & RFIs — Implementation Plan

> Build plan for two new modules. Drafted from the mockups in `/Files`
> (`drawings-tab-mockup.html`, `asbuilt-review-mockup.html`, `rfi-list-mockup.html`,
> `rfi-detail-mockup.html`). Pathwaze remains the source of truth (no Excel round-trip).
> Migrations start at **032** (031 is the current head).

---

## 1. Scope

Two new first-class modules plus a thin tie-in to the existing task system:

| Module | Lives | Purpose |
|--------|-------|---------|
| **Drawings** | New **project-detail tab** | Upload drawings → link each to an area + discipline → review every drawing against an **action plan** (checklist) → log findings |
| **RFIs** | New **master-nav item** | Procore-style Requests for Information, formal Q&A with external parties (EOR/AHJ/Owner), portfolio-wide log |
| **Tasks** (existing) | — | A finding can **Delegate** → internal engineer task (reuses current task framework, unchanged) |

A finding has two outlets: **Delegate** (internal task) or **Create RFI** (external request).

---

## 2. Concept model (locked decisions)

| Decision | Resolution |
|----------|-----------|
| Drawings tab placement | Project-level tab (8th tab, after Financial) |
| Type landing | Tab opens on drawing-type boxes (As-Builts active; Solar PV Design / Permit Sets are future) |
| Area | = a `buildings` row (Building / Parking Lot / Garage / Field / Other) |
| Unit of review | **One review per drawing** — force every drawing to be reviewed |
| Action plan | A checklist **template per drawing type**, **seeded in code** for v1 (admin editor later) |
| Discipline | **One discipline per drawing**; review scope = **Universal + that discipline** |
| Universal Questions | The 20 "ask on every set" items **repeat per drawing but auto-copy across the set** (area + type), with **per-drawing override** |
| RFIs | Master-nav module modeled on Procore; can be created from a finding or standalone |
| Source of truth | Pathwaze (no Excel import/export in v1) |

---

## 3. Data model (migrations 032+)

### 032 — action plans + seed
```
action_plans
  id uuid pk
  drawing_type text          -- 'as_built' (future: 'pv_design', 'permit_set')
  name text                  -- 'As-Built Review'
  version int default 1
  is_active bool default true
  created_at timestamptz

action_plan_sections          -- disciplines, incl. 'Universal'
  id uuid pk
  action_plan_id fk
  key text                   -- 'universal','electrical','structural',...
  label text                 -- 'Electrical'
  is_universal bool default false   -- true => synced across the set
  sort_order int
  suggested_categories text[]       -- optional: which area categories typically use this discipline

action_plan_items
  id uuid pk
  section_id fk
  prompt text                -- the question
  hunting_for text           -- "what you're hunting for" (Universal sheet has this)
  reviewer_hint text         -- null | 'pm_engineer' | 'engineer'  (drives the ⚙ marker)
  sort_order int
```
**Seed** (same migration): one `as_built` plan + sections + items transcribed from
`Copy of AH_AsBuilt_Findings_Tracker_v3.xlsx`:
Universal (20), Electrical (17), Structural (14), Civil/Site (17), Mechanical/Plumbing (9),
Fire/Life-Safety (9), Roofing (8), Architectural (8), Code/Permitting/AHJ (7),
Hazmat/Environmental (5), Telecom/Low-Voltage/Security (4), Aquatic (3).
`reviewer_hint` set on the green/orange items from the memo.

### 033 — drawings
```
drawings
  id uuid pk
  project_id fk -> projects
  area_id fk -> buildings        -- null until linked
  drawing_type text default 'as_built'
  discipline_key text            -- null until tagged; matches action_plan_sections.key
  file_name text
  storage_path text              -- Supabase Storage 'drawings' bucket
  file_size bigint, content_type text
  set_label text                 -- 'IFC 2014 rev.3'
  uploaded_by fk -> users, uploaded_at timestamptz
```

### 034 — reviews + findings
```
drawing_reviews                  -- one per drawing
  id uuid pk
  drawing_id fk unique
  action_plan_id fk
  status text default 'not_started'  -- not_started|in_progress|under_review|complete
  reviewer_id fk -> users, qc_id fk -> users
  due_date date
  created_at, completed_at

review_findings                  -- one row per item the PM acts on (+ ad-hoc)
  id uuid pk
  drawing_review_id fk
  action_plan_item_id fk         -- null for custom/building-specific findings
  disposition text               -- confirmed|field_verify|unknown|conflict|risk|null
  finding_text text
  sheet_ref text
  sow_action text
  is_override bool default false  -- true when overriding a synced Universal answer
  delegated_task_id fk -> tasks   -- set when Delegated
  rfi_id fk -> rfis               -- set when an RFI is created
  created_by, updated_at

set_universal_findings           -- shared Universal answers, per (area + type)
  id uuid pk
  area_id fk -> buildings
  drawing_type text
  action_plan_item_id fk          -- a Universal item
  disposition, finding_text, sheet_ref, sow_action
  updated_by, updated_at
  unique (area_id, drawing_type, action_plan_item_id)
```
**Universal sync logic:** a drawing review renders Universal items from
`set_universal_findings` (shared); editing one pre-fills siblings in the same set.
A per-drawing override writes a `review_findings` row with `is_override = true`
(the UI's "✎ overridden" state); discipline findings always live in `review_findings`.

### 035 — RFIs
```
rfis
  id uuid pk
  project_id fk
  rfi_number int                  -- sequential per project
  subject text, question text
  status text default 'draft'     -- draft|open|closed
  priority text default 'normal'
  ball_in_court_user_id fk -> users          -- internal, OR
  ball_in_court_stakeholder_id fk -> stakeholders   -- external (EOR/AHJ/Owner)
  rfi_manager_id fk -> users
  received_from text
  due_date date, date_initiated date, closed_at timestamptz
  drawing_number text, spec_section text, location text
  cost_impact text default 'tbd'  -- yes|no|tbd
  cost_amount numeric
  schedule_impact text default 'tbd'
  schedule_days int
  is_private bool default false
  -- tie-ins
  area_id fk -> buildings (null)
  drawing_id fk -> drawings (null)
  source_finding_id fk -> review_findings (null)
  official_response_id fk -> rfi_responses (null)
  created_by, created_at
  unique (project_id, rfi_number)

rfi_responses
  id uuid pk
  rfi_id fk
  author_id fk -> users (null for external)
  author_name text, author_email text
  body text
  is_official bool default false
  via text default 'app'          -- app|email
  created_at

rfi_distribution
  id uuid pk
  rfi_id fk
  user_id fk -> users (null) | stakeholder_id fk -> stakeholders (null)
  contact_email text
```
**RFI numbering:** `max(rfi_number)+1` per project via an RPC inside the insert txn.

### 036 — RLS + storage + activity
- RLS on all new tables mirroring `tasks`/project patterns: investors excluded;
  team/manager/admin read all, write per role (helpers in `src/lib/permissions.ts`).
- Supabase Storage bucket **`drawings`** (private), path `{projectId}/{drawingId}/{filename}`,
  RLS like `031_task_files_rls`. (RFI attachments: reuse or `rfi-files` bucket.)
- `activity_log` hooks for drawing-review status changes, finding `risk` dispositions,
  and RFI status changes.

---

## 4. Backend (route handlers, `src/app/api/...`)

| Route | Verb | Purpose |
|-------|------|---------|
| `/api/drawings` | POST / GET | upload metadata / list by project |
| `/api/drawings/[id]` | PATCH / DELETE | link area+discipline (creates the review), remove |
| `/api/drawing-reviews/[id]` | GET / PATCH | load review + items + findings; update status |
| `/api/drawing-reviews/[id]/findings` | POST/PATCH/DELETE | finding CRUD (handles Universal sync + override) |
| `/api/findings/[id]/delegate` | POST | create engineer task (reuse `/api/tasks` logic), set `delegated_task_id` |
| `/api/findings/[id]/rfi` | POST | create RFI from finding, set `rfi_id` |
| `/api/rfis` | GET / POST | portfolio list / create |
| `/api/rfis/[id]` | GET / PATCH | detail / update, close |
| `/api/rfis/[id]/responses` | POST | add response / mark official (closes RFI) |

Reuse: task creation + notification path from existing `/api/tasks`; Resend + Slack helpers.

---

## 5. Frontend

| Area | Work |
|------|------|
| Project tab | Add `{ id:'drawings', label:'Drawings' }` to `TABS` + `VALID_TAB_IDS` in `ProjectDetailClient.tsx`; new `DrawingsTab.tsx` (type landing → As-Built area/drawing list) |
| Drawing review | `DrawingReview` drawer/panel: action-plan checklist, dispositions, findings, progress, Universal sync/override, evidence/PDF view, **Delegate** + **Create RFI** |
| Nav | Add `{ label:'RFIs', href:'/rfis', Icon }` to `NAV_ITEMS` in `NavBar.tsx` |
| RFI list | `/rfis` route + client: filter tabs (All/Open/Overdue/Draft/Closed), project/ball-in-court filters, table |
| RFI detail | `/rfis/[id]`: Procore layout — ball-in-court bar, details panel, question + references, responses thread + official response, distribution, "created from finding" link |
| Reuse | `RichTextEditor` / `NotesRender` for finding text + RFI question/responses; `MessageText` for mentions; existing task create-modal for Delegate |

---

## 6. Notifications & automation

- **Risk disposition** → same-day escalation to Morgan (Slack DM + email) — from the memo.
- **RFI created** → notify ball-in-court; **response added** → notify distribution.
- **Overdue RFIs** → reminder (needs a scheduled job; see open items).
- **Email-reply-without-login** (Procore's marquee feature) → depends on an **inbound email webhook** (BACKLOG #1). **Deferred to Phase 6 / its own track**; v1 RFIs are in-app with outbound email notifications.

---

## 7. Build order

| Phase | Deliverable | Depends on |
|-------|-------------|-----------|
| **P1** | Migrations 032–036 + seed + storage bucket + RLS | — |
| **P2** | Drawings tab: type landing, upload, link area+discipline, drawing list | P1 |
| **P3** | Drawing review UI: checklist from action plan, findings CRUD, dispositions, progress, Universal sync/override | P1, P2 |
| **P4** | Delegation: finding → engineer task (reuse task framework) | P3 |
| **P5** | RFIs: list + detail + create-from-finding + responses/official + notifications | P1, P3 |
| **P6** | Roll-ups, overdue reminders (cron), risk escalation, email-reply track, polish | P2–P5 |

---

## 8. Open decisions (resolve before the relevant phase)

| # | Question | Affects | Default if unspecified |
|---|----------|---------|------------------------|
| O1 | Drawing file storage: **Supabase Storage** vs **Box** | P2 | Supabase Storage (`drawings` bucket), like task-files |
| O2 | External party source for ball-in-court — reuse **stakeholders** CRM, or free-text contacts? | P5 | Reuse stakeholders + allow free-text email |
| O3 | Who can **create RFIs / review drawings** (roles)? | P1 RLS | admin/manager/team (PMs); investors excluded |
| O4 | Reminder/overdue infra — cron (Vercel Cron / scheduled task)? | P6 | Vercel Cron daily |
| O5 | Email-reply-without-login now or later? | P6 | Later (depends on inbound-email, BACKLOG #1) |

---

## 9. Manual follow-ups (not code)

- Create Supabase Storage bucket(s): `drawings` (+ `rfi-files` if separate).
- Coordinate migration numbers with the parked `schedule-tab` branch (also wants 032/033).
- If email-reply is pursued: stand up inbound email (Resend Inbound / SendGrid Parse) + Vercel env.
- Vercel Cron entry for overdue-RFI reminders (Phase 6).
