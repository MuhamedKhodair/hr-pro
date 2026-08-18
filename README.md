# HR Pro - HR Management System

A modern, full-stack HR Management System built with Next.js 15, Express, TypeScript, and Prisma.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, React Hook Form + Zod, TanStack Query, Framer Motion, Recharts
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, JWT auth, bcrypt
- **Database**: SQLite by default (zero-config). Optional PostgreSQL via Docker — see below
- **Package Manager**: pnpm (root), npm (backend has its own lockfile)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma client + run migrations + seed data
#    (backend uses npm; pnpm is used at the root)
npm --prefix backend install
cd backend && npx prisma migrate dev && npx prisma db seed

# 3. Start development servers (frontend + backend)
pnpm dev            # runs backend on :4000 and frontend on :3000
```

The backend runs on `http://localhost:4000` and the frontend on `http://localhost:3000`.

### Using PostgreSQL (optional)

```bash
# 1. Start the database container
docker compose up -d

# 2. Switch Prisma to Postgres
#    - Change `provider` to "postgresql" in backend/prisma/schema.prisma
#    - Set backend/.env DATABASE_URL="postgresql://hrproj:hrproj_secret@localhost:5432/hrproj"

# 3. Re-run migrations + seed
cd backend && npx prisma migrate dev && npx prisma db seed
```

## Demo Credentials

| Email             | Password | Role     |
| ----------------- | -------- | -------- |
| alice@hrpro.com   | admin123 | Admin    |
| bob@hrpro.com     | admin123 | HR       |
| charlie@hrpro.com | admin123 | Employee |
| diana@hrpro.com   | admin123 | Employee |

## Features

1. **Authentication** — JWT-based login with role-based access (Admin, HR, Employee)
2. **Employee Management** — CRUD, search, pagination, bulk CSV import, manager & shift assignment, document uploads (contracts/IDs), CSV export, org chart
3. **Department Management** — CRUD with employee count
4. **Attendance** — Check-in/check-out, team view with date-range and employee filters, manual entry/override, bulk CSV import, automatic overtime on checkout, CSV export
5. **Leave Management** — Submit, edit and cancel pending requests, half-day support, automatic day calculation, attachment upload (e.g. medical certificates), review with comments, CSV export
6. **Shifts** — Define work shifts and assign employees
7. **Payroll** — Salary structures with component history, monthly payroll generation, per-record adjustments, finalization, payslips, department cost breakdown, monthly trend, CSV export
8. **Dashboard** — Animated stats, department headcount chart, recent activity feed, upcoming birthdays/anniversaries, leave calendar widget
9. **Notifications** — In-app notifications for new leave requests, review outcomes, and payroll-ready, with unread badge and mark-as-read
10. **Global Search** — Press `Ctrl+K` (or `Cmd+K`) to search across employees, departments and leave requests
11. **Settings** — Admin-configurable company info, currency, fiscal year start, working days and week start (used by payroll formatting and leave logic)
12. **Audit Log** — Admin-only trail of administrative actions (employee/leave/attendance/payroll/shift changes)
13. **i18n** — English and Arabic with RTL support; `npm --prefix frontend run i18n:check` validates translation completeness
14. **Security** — Helmet, rate limiting (general + auth), configurable CORS, 5MB JSON body limit

## Design Notes

- **Style**: Enterprise-classic — calm slate neutrals with a professional blue primary (`#2563eb`), layered light-gray canvas with white cards, subtle borders and shadows.
- **Typography**: Inter with refined font-feature settings; clear hierarchy (page headers, small-caps table headers).
- **Data Tables**: Dense, well-organized tables via shared `Table` primitives (uppercase muted headers, 13px cells, row hover) that stay readable on every screen.
- **Dark Mode**: Full dark mode via `next-themes` with a deep slate/navy palette and smooth transitions.
- **Responsive**: Mobile-first layouts. Sidebar collapses to drawer on small screens. Data tables become card grids on mobile.
- **Animations**: Restrained Framer Motion usage — page fades, staggered list entries, animated counters on the dashboard, toast slide-ins.
- **Data Loading**: Skeleton loaders (not spinners) during TanStack Query fetches. Empty states and error states use icons and clear messaging.
- **Charts**: Recharts for department headcount, attendance trends, leave distribution and payroll trends.
- **API Shape**: All API responses follow `{ success: boolean, data?: T, error?: string }`.
- **Validation**: Zod schemas are defined independently on both frontend and backend but share the same logic.

## Project Structure

```
hrproj/
├── backend/
│   ├── prisma/          # Schema, migrations, seed
│   └── src/
│       ├── controllers/ # Route handlers
│       ├── services/    # Business logic
│       ├── routes/      # Express routes
│       ├── middleware/  # Auth, error handling, validation
│       ├── lib/         # Prisma client, errors, CSV, pagination, uploads
│       └── types/       # TypeScript types
├── frontend/
│   └── src/
│       ├── app/         # Next.js App Router pages
│       ├── components/  # UI, layout, dashboard components
│       ├── hooks/       # Custom React hooks
│       └── lib/         # API client, utils, validations, i18n, settings
└── docker-compose.yml   # PostgreSQL container (optional)
```
