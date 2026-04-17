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
