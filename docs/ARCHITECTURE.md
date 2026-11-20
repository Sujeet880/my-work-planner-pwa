# Architecture — My Work Planner PWA

## 1. Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7, `lucide-react`
- **Database & Auth (Milestones 1–3):** Supabase Auth (Private Email Magic Link) + PostgreSQL with strict Row Level Security (RLS)
- **Server Boundary (Milestones 1–6):** Server-only configuration under `server/` (`server/config/env.ts`, `server/config/supabaseServer.ts`) so privileged keys (`SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`) never enter the browser bundle
- **PWA:** Web App Manifest (`public/manifest.webmanifest`), PNG/SVG icons (`public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/apple-touch-icon.png`), and minimal app-shell service worker (`public/sw.js`)

## 2. Folder Structure

```text
/
├── public/
│   ├── manifest.webmanifest      # Installable PWA manifest
│   ├── sw.js                     # Minimal app-shell-only service worker
│   ├── icon.svg                  # Vector brand icon
│   ├── pwa-192x192.png           # Standard 192px icon
│   ├── pwa-512x512.png           # Standard 512px icon
│   ├── pwa-maskable-512x512.png  # Maskable 512px icon
│   └── apple-touch-icon.png      # 180px iOS touch icon
├── server/
│   └── config/
│       ├── env.ts                # Server-only env validation skeleton
│       └── supabaseServer.ts     # Server-only privileged Supabase factory
├── src/
│   ├── components/
│   │   ├── layout/AppShell.tsx   # Desktop sidebar + top bar, Tablet drawer, Mobile bottom nav + sticky timer
│   │   ├── pwa/                  # PWAInstallButton, OfflineIndicator
│   │   ├── tasks/                # TaskRow, TaskFormDrawer
│   │   ├── timer/                # ActiveTimerCard, ManualTimeEntryModal, TimerConfirmationModals
│   │   └── ui/                   # Button, Field, Badges, MetricCard, Drawer, Modal, EmptyState
│   ├── context/
│   │   ├── AuthContext.tsx       # Supabase config & route-guard readiness
│   │   └── WorkspaceContext.tsx  # Local M0 preview state & timestamp-driven timer controller
│   ├── data/
│   │   └── previewData.ts        # Isolated, removable Milestone 0 layout-evaluation dataset
│   ├── features/
│   │   ├── auth/                 # SignInPage (/sign-in)
│   │   ├── dashboard/            # DashboardPage (/, /dashboard)
│   │   ├── projects/             # ProjectsPage (/projects)
│   │   ├── reports/              # ReportsPage (/reports)
│   │   ├── settings/             # SettingsPage (/settings), GoogleCalendarPage (/settings/google-calendar)
│   │   ├── tasks/                # MyTasksPage (/tasks), TaskDetailsPage (/tasks/:taskId)
│   │   └── time-tracker/         # TimeTrackerPage (/time-tracker)
│   ├── hooks/                    # usePWAInstall, useOnlineStatus
│   ├── lib/
│   │   ├── env.ts                # Safe client-side VITE_* loader
│   │   ├── pwa.ts                # Service worker registration helper
│   │   ├── supabaseClient.ts     # Safe browser Supabase client factory
│   │   ├── timeMath.ts           # Pure calculations & form validation helpers
│   │   └── timeMath.test.ts      # Node built-in unit tests (node:test)
│   └── types/
│       └── models.ts             # Strict domain models matching PRD Section 18
└── docs/
    ├── ARCHITECTURE.md
    ├── IMPLEMENTATION_PLAN.md
    └── IMPLEMENTATION_NOTES.md
```

## 3. Core Architectural Invariants

1. **Timestamp-Driven Timer Integrity:** Active timer duration is always calculated from timestamps (`accumulatedBeforeSegmentSeconds + (nowMs - startedAtMs)`) rather than counting React intervals. Saved work time strictly sums `status === 'completed'` entries; active session time is displayed separately or added cleanly once (`Live Actual = Saved + Active`) with zero double-counting.
2. **Single Active Timer Rule:** Starting a timer on another task never silently drops the current session—it triggers an explicit **Save & Switch** confirmation modal.
3. **Explicit Completion Safeguard:** Completing a task while its timer is active opens a confirmation modal (**Stop, Save & Complete** vs **Cancel**).
4. **Strict Client/Server Secret Boundary:** Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_BASE_URL` are ever read inside `src/`. Server secrets live strictly under `server/`.
5. **Honest Integration States:** Unconfigured services (Supabase Auth/DB in M0, Google Calendar OAuth until M6) display explicit disconnected/setup-required states instead of fabricated connected badges.
