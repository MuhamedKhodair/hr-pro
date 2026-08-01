# HR Pro - HR Management System

A modern, full-stack HR Management System built with Next.js 15, Express, TypeScript, and PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, React Hook Form + Zod, TanStack Query, Framer Motion, Recharts
- **Backend**: Node.js 22, Express, TypeScript, Prisma ORM, JWT auth, bcrypt
- **Database**: SQLite (via Prisma)
- **Package Manager**: pnpm

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma client + run migrations + seed data
pnpm --filter backend prisma:migrate

# 3. Start development servers (frontend + backend)
pnpm dev
```

The backend runs on `http://localhost:4000` and the frontend on `http://localhost:3000`.

## Demo Credentials

| Email             | Password | Role     |
| ----------------- | -------- | -------- |
| alice@hrpro.com   | admin123 | Admin    |
| bob@hrpro.com     | admin123 | HR       |
| charlie@hrpro.com | admin123 | Employee |
| diana@hrpro.com   | admin123 | Employee |

## Features

1. **Authentication** — JWT-based login with role-based access (Admin, HR, Employee)
2. **Employee Management** — CRUD for employee records with search, mobile cards, and desktop table
3. **Department Management** — CRUD for departments with employee count
4. **Attendance** — Daily check-in/check-out, today's attendance log
5. **Leave Management** — Submit and approve/reject leave requests
6. **Dashboard** — Animated stats cards, pie chart for leave distribution, bar chart for attendance trends

## Design Notes

- **Color Palette**: Indigo/violet primary (`#6366f1` / `#a78bfa`) on warm off-white background for a distinct, modern look — avoids the default gray-on-white shadcn appearance.
- **Dark Mode**: Full dark mode via `next-themes` with smooth transitions and custom dark palette.
- **Responsive**: Mobile-first layouts. Sidebar collapses to drawer on small screens. Data tables become card grids on mobile.
- **Animations**: Framer Motion powers page transitions (fade/slide), staggered list entries, animated number counters on the dashboard, button micro-interactions, and toast slide-ins.
- **Data Loading**: Skeleton loaders (not spinners) during TanStack Query fetches. Empty states and error states use icons and clear messaging.
- **Charts**: Recharts for a pie chart (leave distribution) and stacked bar chart (attendance trends).
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
│       ├── middleware/   # Auth, error handling, validation
│       ├── lib/         # Prisma client, errors
│       └── types/       # TypeScript types
├── frontend/
│   └── src/
│       ├── app/         # Next.js App Router pages
│       ├── components/  # UI, layout, dashboard components
│       ├── hooks/       # Custom React hooks
│       └── lib/         # API client, utils, validations
└── docker-compose.yml   # PostgreSQL container
```
