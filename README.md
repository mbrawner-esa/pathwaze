# Pathwaze

Project-management & CRM web app for **ESA Solar**, managing **19 AdventHealth
BTM solar projects** across Florida and Illinois (5 investment tranches,
~49.5 MWdc). It covers the full development lifecycle: projects & financials,
tasks, stakeholders (CRM), a drawings review workflow, an RFI log, a dataroom
health dashboard, and an investor portal.

- **Live:** https://pathwaze.esa-solar.com
- **Repo:** https://github.com/mbrawner-esa/pathwaze
- **Hosting:** Vercel — auto-deploys on push to `main`

---

## Documentation

| File | What it's for |
|------|---------------|
| **README.md** (this) | Overview + local setup |
| [CLAUDE.md](CLAUDE.md) | How to work in the codebase — conventions, schema, logo protocol, build/ship rules. Read before editing. |
| [ROADMAP.md](ROADMAP.md) | What's next, later, and parked |
| [CHANGELOG.md](CHANGELOG.md) | What has shipped, newest first |
| `docs/archive/` | Superseded historical docs (early handoff, old backlog, drawings design plan) |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router), TypeScript |
| Database + Auth | Supabase (Postgres + Row-Level Security + Auth) |
| Styling | Tailwind CSS + shadcn/ui, custom design system |
| Hosting | Vercel (auto-deploy on push to `main`) |
| Email | Resend (branded notification shell) |
| Files | Supabase Storage; Box SDK (dataroom, partial) |

---

## Local setup

> ⚠️ Use the canonical clone at `Documents\Pathwaze Local`, **not** the old
> Box-Drive copy. See [CLAUDE.md](CLAUDE.md) → "Working directory & repo" for why.

```bash
# from the canonical clone
npm install          # node_modules works here (not on the Box copy)
npm run dev          # http://localhost:3000
```

Create a `.env.local` (gitignored) with:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only; used by cron routes) |
| `RESEND_API_KEY` | Resend email API key |
| `NEXT_PUBLIC_APP_URL` | Full deployment URL (e.g. `https://pathwaze.esa-solar.com`) |
| `CRON_SECRET` | Bearer secret Vercel sends to `/api/cron/*` routes |
| `BOX_CLIENT_ID` / `BOX_CLIENT_SECRET` / `BOX_ENTERPRISE_ID` | Box app credentials (partial integration) |

The same values live in Vercel project settings for deployed environments.

---

## Before you commit

```bash
npx next lint        # must be clean
npx tsc --noEmit     # must be clean
```

Deploys **do not run database migrations**. If your change adds a
`supabase/migrations/NNN_*.sql` file, that SQL must be run manually on Supabase.
Migrations are numbered sequentially and idempotent.

---

## Project structure

```
src/
├── app/
│   ├── (app)/            # authed route group — dashboard, projects, tasks,
│   │                     #   rfis, stakeholders, dataroom, settings, admin
│   ├── api/              # route handlers (each verifies auth itself)
│   ├── auth/             # login + pending-approval
│   └── email-logo/       # edge route: rasterizes the email logo PNG
├── components/           # ui/ primitives + feature folders (project/, tasks/,
│                         #   rfis/, dashboard/, stakeholders/, dataroom/)
├── lib/                  # supabase clients, permissions, email, rfi-notify, utils
├── middleware.ts         # auth guard (getSession, not getUser; excludes /api)
└── types/                # generated DB types
supabase/migrations/      # canonical, numbered, idempotent schema
```

See [CLAUDE.md](CLAUDE.md) for the database schema, roles/permissions model,
route map, and the shared UI/notification conventions.

---

## Deploy

Push to `main`; Vercel builds and deploys in ~2 minutes. Watch build logs at the
Vercel project for TypeScript errors before they reach production. Remember to
run any new Supabase migration manually.
