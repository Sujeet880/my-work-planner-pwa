# My Work Planner — Session Persistence & Password Authentication Guide

## 1. Overview & Objectives

In early versions of My Work Planner, authentication relied exclusively on Supabase Email Magic Links without password sign-in. This introduced several user friction points:
1. Users were forced to check their email every time they wanted to open the app on a new device or after session expiration.
2. If Magic Link redirects failed (e.g. redirected to localhost), users were completely locked out.
3. Lack of a "Remember Me" control meant browser restarts frequently discarded session tokens.

In **Milestone 11**, the authentication architecture was enhanced with:
- **Email + Password Authentication** (`signInWithPassword`).
- **Remember Me on this device** (Default checked, backed by dynamic storage routing).
- **Password Reset Flow** (`resetPasswordForEmail` -> `/auth/reset-password` -> `updateUser`).
- **In-App Password Management** in Settings.
- **Full Backward Compatibility** with Email Magic Links.

---

## 2. Dynamic Storage Adapter & Session Persistence

### 2.1 The Problem with Static Storage
Standard Supabase JS client configuration defaults to `localStorage`. While `localStorage` persists across restarts, users on shared or public computers need the option to sign in for a single session (`sessionStorage`), where closing the browser automatically revokes local session tokens.

### 2.2 Dual Storage Routing Implementation (`src/lib/supabaseClient.ts`)
```ts
const REMEMBER_ME_STORAGE_KEY = 'my_work_planner_remember_me';
export const AUTH_TOKEN_STORAGE_KEY = 'my_work_planner_auth_token';

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === 'undefined') return;
  if (remember) {
    localStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'true');
    sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
  } else {
    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    sessionStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'false');
  }
}

export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true;
  if (sessionStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'false') return false;
  return localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== 'false';
}

const dynamicAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return getRememberMePreference()
      ? localStorage.getItem(key) ?? sessionStorage.getItem(key)
      : sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    if (getRememberMePreference()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
```

When initializing Supabase:
```ts
createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_TOKEN_STORAGE_KEY,
    storage: dynamicAuthStorage,
  },
});
```

---

## 3. Password Authentication Workflows

### 3.1 Sign In (`/sign-in`)
- **Default Tab: Email & Password**:
  - Fields: Email, Password (with eye toggle show/hide), Remember Me checkbox.
  - Submits via `signInWithPassword(email, password, rememberMe)`.
  - Authoritative role check runs immediately upon authentication:
    - If Owner: redirects to `/dashboard`.
    - If Client: redirects to `/portal`.
    - If `returnTo` specified: redirects to preserved URL.
- **Alternate Tab: Magic Link**:
  - Passwordless option remains fully operational.
  - 60-second countdown cooldown timer prevents OTP request abuse.

### 3.2 Forgot Password Flow (`/auth/forgot-password`)
1. User enters their registered email address.
2. Application calls:
   ```ts
   supabase.auth.resetPasswordForEmail(email, {
     redirectTo: getPasswordResetUrl(), // https://my-work-planner-pwa.vercel.app/auth/reset-password
   });
   ```
3. User receives a password recovery email containing an authenticated recovery link.

### 3.3 Set New Password (`/auth/reset-password`)
1. User clicks the email recovery link, landing on `/auth/reset-password`.
2. Supabase Auth hydrates a recovery session from URL hash tokens (`#access_token=...&type=recovery`).
3. User enters New Password and Confirm Password (validated for $\ge 6$ characters).
4. Submits via `supabase.auth.updateUser({ password: newPassword })`.
5. On success, redirects the user directly into their authorized workspace or client portal.

### 3.4 In-App Password Update (Settings)
- Authenticated users can navigate to **Settings** -> **Password & Security**.
- Enter a new password and confirmation.
- Changes are applied instantly without requiring email verification.

---

## 4. Security Invariants
- **No plaintext password storage**: Passwords are handled exclusively by Supabase Auth (bcrypt/Argon2 hashing).
- **Zero custom password tables**: No password fields or hashes exist in application PostgreSQL tables (`workspace_roles`, `profiles`, etc.).
- **Automatic session refresh**: Supabase JS automatically refreshes expired JWT tokens in the background using persisted refresh tokens.
