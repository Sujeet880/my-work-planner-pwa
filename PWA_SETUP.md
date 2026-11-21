# My Work Planner — Progressive Web App (PWA) Setup & Architecture

## Overview

My Work Planner is architected as a production-grade Progressive Web App (PWA) designed for desktop and mobile environments. It delivers a fast, installable, fullscreen application experience with offline app-shell caching and background Web Push notification capabilities.

---

## 1. Web App Manifest (`public/manifest.webmanifest`)

The Web App Manifest declares app identity, icons, appearance, and launcher shortcuts:

- **Identity**:
  - `id`: `"/"`
  - `name`: `"My Work Planner"`
  - `short_name`: `"Work Planner"`
  - `start_url`: `"/"`
  - `scope`: `"/"`
- **Display & Theming**:
  - `display`: `"standalone"` (opens in a dedicated application window without browser chrome)
  - `orientation`: `"any"`
  - `background_color`: `"#F6F7F9"`
  - `theme_color`: `"#4968D6"`
- **Icons**:
  - `pwa-192x192.png`: 192x192 PNG (`purpose: any`)
  - `pwa-512x512.png`: 512x512 PNG (`purpose: any`)
  - `pwa-maskable-512x512.png`: 512x512 PNG (`purpose: maskable` for Android adaptive icon shapes)
- **Shortcuts**:
  - **Today Tasks**: `/tasks?tab=today`
  - **Time Tracker**: `/time-tracker`

---

## 2. Service Worker (`public/sw.js`)

The service worker runs in the background independent of active browser tabs:

### A. Lifecycle Management
- **`install` event**: Pre-caches essential shell metadata (`/`, `/manifest.webmanifest`, `/icon.svg`) and immediately activates via `skipWaiting()`.
- **`activate` event**: Invalidates obsolete cache versions and immediately claims active clients via `self.clients.claim()`.
- **`fetch` event**:
  - Implements a **network-first** strategy for navigation and static assets to ensure users always receive the freshest production builds.
  - **Strict Security Barrier**: Bypasses caching for cross-origin requests, Supabase API calls (`/rest/v1`, `/auth/v1`), and internal `/api/` endpoints to prevent storing private user data or credentials in local cache storage.

### B. Background Web Push Notifications
- **`push` event**:
  - Listens for encrypted server-pushed notifications from the `dispatch-task-reminders` Edge Function.
  - Parses JSON payload: `{ title, body, tag, data: { url, taskId } }`.
  - Dispatches system notification via `self.registration.showNotification()`.
- **`notificationclick` event**:
  - Automatically dismisses notification badge via `event.notification.close()`.
  - Searches for an already open My Work Planner window:
    - If found: navigates to target task (`/tasks/:id`) and focuses the tab.
    - If not found: opens a new standalone application window via `clients.openWindow()`.
- **`notificationclose` event**:
  - Handles dismissal gracefully.

---

## 3. Platform-Specific Installation Guidance

### A. Desktop Chrome / Microsoft Edge / Chromium (macOS, Windows, Linux)
1. Supported automatically via the W3C `beforeinstallprompt` event.
2. Clicking **Install App** in the header or in Settings invokes `event.prompt()`.
3. Alternatively, click the **Install icon** in the browser URL address bar.
4. Creates a native desktop shortcut and standalone window.

### B. Safari on macOS (macOS Sonoma 14+)
1. Open My Work Planner in Safari.
2. Click **File** in the top macOS menu bar.
3. Select **Add to Dock...**.
4. The app launches in its own isolated application window with independent dock badge and notification permissions.

### C. Safari on iOS / iPadOS (iOS 16.4+)
> [!IMPORTANT]
> iOS Safari requires adding the web app to the Home Screen to enable Web Push notification support.
1. Open My Work Planner in Safari.
2. Tap the **Share** button in the Safari toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Open the installed app from your Home Screen.
5. Navigate to **Settings** and tap **Enable Push Notifications** to grant iOS notification permissions.
