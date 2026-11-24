# My Work Planner — Authentication & Redirect URL Architecture

## 1. Problem Statement & Root Cause

### 1.1 The Issue
Client invitation links and Magic Link emails sent through Supabase Auth were redirecting users to:
`http://localhost:3000/auth/callback`
instead of the production domain:
`https://my-work-planner-pwa.vercel.app`

### 1.2 Root Cause
1. In `.env.local`, `VITE_APP_BASE_URL` was configured as `http://localhost:3000`.
2. When Vite bundled the client-side code, `import.meta.env.VITE_APP_BASE_URL` evaluated to `http://localhost:3000` or was read statically.
3. In `AuthContext.tsx` and `sharingService.ts`, redirect URLs were generated as:
   ```ts
   const callbackUrl = redirectTo ?? `${env.appBaseUrl}/auth/callback`;
   ```
4. As a result, when an invitation email or Magic Link was requested from a browser on `https://my-work-planner-pwa.vercel.app`, the application explicitly asked Supabase to redirect the user to `http://localhost:3000/auth/callback`.
5. On mobile devices or machines without a local dev server running, the link failed to load (`ERR_CONNECTION_REFUSED`).

---

## 2. Centralized Redirect Strategy (`src/lib/redirectUrl.ts`)

To permanently eliminate this failure class, URL generation is centralized in `src/lib/redirectUrl.ts` as the single source of truth across the codebase.

### 2.1 Dynamic Runtime Resolution Logic
```ts
const PRODUCTION_DOMAIN = 'https://my-work-planner-pwa.vercel.app';
const LOCAL_DEV_DOMAIN = 'http://localhost:3000';

export function getAppBaseUrl(): string {
  // 1. Browser Runtime: Match the active host dynamically
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  // 2. Build-Time / SSR / Edge Fallback
  const envBase = import.meta.env.VITE_APP_BASE_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim().length > 0) {
    const trimmed = envBase.trim();
    // Guard: Prevent baking localhost into production builds
    if (process.env.NODE_ENV === 'production' && trimmed.includes('localhost')) {
      return PRODUCTION_DOMAIN;
    }
    return trimmed;
  }

  return PRODUCTION_DOMAIN;
}
```

### 2.2 Canonical Redirect Helpers
All subsystems now reference these standard generators:

| Helper | URL Produced in Production | URL Produced in Local Dev | Usage |
| :--- | :--- | :--- | :--- |
| **`getAuthCallbackUrl()`** | `https://my-work-planner-pwa.vercel.app/auth/callback` | `http://localhost:3000/auth/callback` | Magic Link sign-in, OAuth providers |
| **`getPasswordResetUrl()`** | `https://my-work-planner-pwa.vercel.app/auth/reset-password` | `http://localhost:3000/auth/reset-password` | Password recovery emails |
| **`getInvitationUrl(token)`**| `https://my-work-planner-pwa.vercel.app/invite/<token>` | `http://localhost:3000/invite/<token>` | Client collaboration invitations |

---

## 3. Remote Supabase Auth Configuration Requirements

For Supabase to honor these redirects, the following settings must be present in the Supabase Dashboard:

### 3.1 Site URL
- **Site URL**: `https://my-work-planner-pwa.vercel.app`

### 3.2 Redirect URLs (Allowed Callback Whitelist)
- `https://my-work-planner-pwa.vercel.app/**`
- `https://my-work-planner-pwa.vercel.app/auth/callback`
- `https://my-work-planner-pwa.vercel.app/auth/reset-password`
- `https://my-work-planner-pwa.vercel.app/invite/**`
- `http://localhost:3000/**`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`
- `http://localhost:3000/invite/**`

---

## 4. Verification & Invariants

1. **Active Host Parity**: When running in production on Vercel, `window.location.origin` returns `https://my-work-planner-pwa.vercel.app`. Supabase Auth emails will link to the live production site.
2. **Localhost Parity**: When running locally on `http://localhost:3000`, `window.location.origin` returns `http://localhost:3000`, preserving local developer velocity.
3. **Automated Test Validation**: Verified in `src/services/authAndRoles.test.ts` with 100% pass rate.
