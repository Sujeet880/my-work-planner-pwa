# My Work Planner — Web Push & VAPID Setup Guide

## Overview

My Work Planner uses Voluntary Application Server Identification (VAPID, RFC 8292) to authenticate push notification dispatching to client browsers without third-party proprietary dependencies.

---

## 1. VAPID Key Infrastructure

A standard NIST P-256 (prime256v1) keypair was generated for this project:

- **Public Key (`VAPID_PUBLIC_KEY` / `VITE_VAPID_PUBLIC_KEY`)**:
  65-byte uncompressed P-256 curve point, base64url encoded. Safe for client exposure in the browser bundle.
- **Private Key (`VAPID_PRIVATE_KEY`)**:
  32-byte scalar, base64url encoded. Strictly server-side secret on Supabase Edge Functions.
- **Subject (`VAPID_SUBJECT`)**:
  `mailto:ktsujeet1997@gmail.com`

---

## 2. Secrets Configuration

### Supabase Edge Functions (Remote Production)
The following secrets are configured on project `tefxkrigwvyiescuctmb`:

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY="<base64url-public-key>" \
  VAPID_PRIVATE_KEY="<base64url-private-key>" \
  VAPID_SUBJECT="mailto:ktsujeet1997@gmail.com"
```

### Local Client Environment (`.env.local`)
```env
VITE_VAPID_PUBLIC_KEY="<base64url-public-key>"
```

---

## 3. Browser Compatibility Matrix

| Browser | Push API | Notification API | Standalone PWA | Web Push Support |
| :--- | :---: | :---: | :---: | :---: |
| **Google Chrome (Desktop / Android)** | ✅ | ✅ | ✅ | Full support |
| **Microsoft Edge (Desktop)** | ✅ | ✅ | ✅ | Full support |
| **Mozilla Firefox (Desktop / Android)** | ✅ | ✅ | ✅ | Full support |
| **Apple Safari (macOS 16+)** | ✅ | ✅ | ✅ | Full support |
| **Apple Safari (iOS / iPadOS 16.4+)** | ✅ | ✅ | ✅ (Home Screen) | Supported after "Add to Home Screen" |

---

## 4. Testing Web Push Notifications

1. Open the application in a supported browser (e.g. `http://localhost:3000`).
2. Sign in to your workspace.
3. Navigate to **Settings** (`/settings`).
4. In the **Reminders & Push Notifications** section, click **Enable Push Notifications**.
5. When prompted by your browser, click **Allow**.
6. Click **Test Notification**:
   - The Edge Function `dispatch-task-reminders` will be invoked with `{ test: true }`.
   - Your device will display a system notification: *"🔔 Test Notification — Push notifications are working perfectly on this device!"*.
