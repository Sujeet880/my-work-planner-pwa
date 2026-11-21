# Google Cloud Console & Supabase Setup Guide — Google Calendar Integration

This guide provides the exact, step-by-step procedure for configuring the Google Cloud Console OAuth 2.0 Web Client and setting Supabase Edge Function secrets for **My Work Planner**.

---

## 1. Google Cloud Console Setup

### Step 1 — Create / Select Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or create a new project named **My Work Planner**.

### Step 2 — Enable Google Calendar API
1. Navigate to **APIs & Services** > **Library**.
2. Search for **Google Calendar API**.
3. Click **Enable**.

### Step 3 — Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Choose **User Type**:
   - Select **External** (standard for user-facing applications).
   - Click **Create**.
3. **App Information**:
   - **App name**: `My Work Planner`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
   - Click **Save and Continue**.
4. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Filter and select:
     - `https://www.googleapis.com/auth/calendar.events` (Manage secondary Google calendars and events)
     - `https://www.googleapis.com/auth/userinfo.email` (View primary Google account email)
   - Click **Update** and then **Save and Continue**.
5. **Test Users** (Critical if consent screen is in *Testing* status):
   - Click **Add Users**.
   - Enter your personal or test Google email address (e.g. `your-email@gmail.com`).
   - Click **Save and Continue**.

### Step 4 — Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Application type**: **Web application**.
4. Set **Name**: `My Work Planner Web Client`.
5. Under **Authorized redirect URIs**, click **Add URI** and enter the exact callback URL:
   ```
   https://tefxkrigwvyiescuctmb.supabase.co/functions/v1/google-calendar-auth/callback
   ```
   *(For local edge function development, you can additionally add: `http://localhost:54321/functions/v1/google-calendar-auth/callback`)*
6. Click **Create**.
7. Securely record your **Client ID** and **Client Secret**.

---

## 2. Supabase Edge Function Secrets Configuration

Run the following command in your terminal using the Supabase CLI to securely configure server-side secrets. **Never commit these values to source control or GitHub.**

```bash
npx supabase secrets set \
  GOOGLE_CLIENT_ID="<your-google-client-id>.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="<your-google-client-secret>" \
  GOOGLE_REDIRECT_URI="https://tefxkrigwvyiescuctmb.supabase.co/functions/v1/google-calendar-auth/callback" \
  ENCRYPTION_KEY="<generate-a-random-32-byte-hex-or-string>" \
  APP_BASE_URL="http://localhost:3000"
```

> [!TIP]
> To generate a secure 32-byte encryption key on macOS or Linux, run:
> ```bash
> openssl rand -hex 32
> ```

---

## 3. Remote Verification Checklist

| Checkpoint | Status | Details |
|---|:---:|---|
| **Database Migration** | ✅ **Applied** | `20261121000003_google_calendar_integration.sql` applied to remote project `tefxkrigwvyiescuctmb`. |
| **`google-calendar-auth` Function** | ✅ **Deployed** | Active at `https://tefxkrigwvyiescuctmb.supabase.co/functions/v1/google-calendar-auth`. |
| **`google-calendar-sync` Function** | ✅ **Deployed** | Active at `https://tefxkrigwvyiescuctmb.supabase.co/functions/v1/google-calendar-sync`. |
| **Tokens Table Security** | ✅ **Locked** | `google_calendar_tokens` revoked from `public`, `anon`, `authenticated`. Accessible strictly via `service_role`. |
| **Google Secrets Config** | ⏳ **User Action** | Run `npx supabase secrets set` with your OAuth Client ID & Secret. |
