# My Work Planner PWA

A private, calm, personal productivity and time-tracking Progressive Web App (PWA) for Desktop and Mobile, built with React, TypeScript, Tailwind CSS v4, and Vite.

## Current Milestone Status

- **Completed:** Milestone 0 — Architecture, Design System, Responsive App Shell, Pure Time Math + Unit Tests, and PWA Foundation.
- **Pending Owner Authorization:** Milestone 1 (Supabase Auth — Private Magic Link) and subsequent backend/integration milestones.

> **Important:** In Milestone 0, external services (Supabase, Google Calendar OAuth, GitHub, and hosting) are intentionally unconfigured. The application runs in a transparent **Milestone 0 Preview Mode** backed by isolated, removable preview data (`src/data/previewData.ts`) so the full shell, navigation, layouts, and timer/form interactions can be reviewed prior to Milestone 1.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` — Start Vite development server on port `3000`.
- `npm run build` — Build production bundle (`dist/`).
- `npm run lint` — Run TypeScript type check (`tsc --noEmit`).
- `npx --yes tsx --test src/lib/timeMath.test.ts` — Run pure domain logic unit tests.

## Environment Variables

Copy `.env.example` to `.env` when configuring external services in Milestone 1+.

- **Browser-safe (`VITE_*`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_BASE_URL`
- **Server-only (never exposed to browser code):** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_BASE_URL`, `ALLOWED_USER_EMAILS`

## Project Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Modular architecture, data boundaries, PWA setup, and security model.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — Milestone 0–7 roadmap and acceptance criteria.
- [`docs/IMPLEMENTATION_NOTES.md`](docs/IMPLEMENTATION_NOTES.md) — Source-of-truth precedence and PRD-vs-Stitch conflict resolutions.
