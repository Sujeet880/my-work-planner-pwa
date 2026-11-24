# My Work Planner — Authentication Email Templates Configuration

This guide provides the exact dashboard mapping, subject lines, replacement variables, and setup instructions for configuring My Work Planner's branded HTML email templates in Supabase.

---

## 1. Supabase Dashboard Location

In the Supabase Management Console:
1. Navigate to your project: **`tefxkrigwvyiescuctmb` (My Task Planer)**
2. In the left navigation sidebar, select **Authentication** (padlock icon).
3. Under the Configuration submenu, select **Email Templates**.

---

## 2. Template Mapping & Configuration

### Template 1: Password Recovery
- **Supabase Template Tab**: **Reset Password**
- **File**: [`supabase/templates/recovery.html`](file:///Users/sujitwork/Desktop/WORK/my-work-planner/supabase/templates/recovery.html)
- **Subject**: `Reset your My Work Planner password`
- **Supported Variables**:
  - `{{ .ConfirmationURL }}`: Secure single-use password recovery redirect link (`https://my-work-planner-pwa.vercel.app/auth/reset-password`).
  - `{{ .TokenHash }}`: Token hash for headless verification.
  - `{{ .SiteURL }}`: Project canonical origin (`https://my-work-planner-pwa.vercel.app`).
  - `{{ .Email }}`: Recipient's email address.

---

### Template 2: Magic Link (Passwordless Sign-In)
- **Supabase Template Tab**: **Magic Link**
- **File**: [`supabase/templates/magic_link.html`](file:///Users/sujitwork/Desktop/WORK/my-work-planner/supabase/templates/magic_link.html)
- **Subject**: `Your secure sign-in link for My Work Planner`
- **Supported Variables**:
  - `{{ .ConfirmationURL }}`: Single-use authentication callback link (`https://my-work-planner-pwa.vercel.app/auth/callback`).
  - `{{ .TokenHash }}`: Single-use OTP token hash.
  - `{{ .Email }}`: Recipient's email address.

---

### Template 3: Project Invitation (Invite User)
- **Supabase Template Tab**: **Invite User**
- **File**: [`supabase/templates/invite.html`](file:///Users/sujitwork/Desktop/WORK/my-work-planner/supabase/templates/invite.html)
- **Subject**: `You've been invited to a project on My Work Planner`
- **Supported Variables**:
  - `{{ .ConfirmationURL }}`: Single-use project invitation link (`https://my-work-planner-pwa.vercel.app/invite/<token>`).
  - `{{ .SiteURL }}`: Canonical project origin.
  - `{{ .Email }}`: Recipient's email address.

---

### Template 4: Email Confirmation
- **Supabase Template Tab**: **Confirm signup**
- **File**: [`supabase/templates/confirm_email.html`](file:///Users/sujitwork/Desktop/WORK/my-work-planner/supabase/templates/confirm_email.html)
- **Subject**: `Confirm your My Work Planner email`
- **Supported Variables**:
  - `{{ .ConfirmationURL }}`: Email verification link.
  - `{{ .Email }}`: Recipient's email address.

---

### Template 5: Password Changed Notification
- **Supabase Template Tab**: **Change email address / User notifications** (or custom transactional)
- **File**: [`supabase/templates/password_changed.html`](file:///Users/sujitwork/Desktop/WORK/my-work-planner/supabase/templates/password_changed.html)
- **Subject**: `Your My Work Planner password was changed`
- **Supported Variables**:
  - `{{ .SiteURL }}`: Project canonical origin.
  - `{{ .Email }}`: Recipient's email address.

---

## 3. Redirect Whitelist Verification

Ensure the following URLs are saved under **Authentication** -> **URL Configuration** -> **Redirect URLs**:
- `https://my-work-planner-pwa.vercel.app/**`
- `https://my-work-planner-pwa.vercel.app/auth/callback`
- `https://my-work-planner-pwa.vercel.app/auth/reset-password`
- `https://my-work-planner-pwa.vercel.app/invite/**`
- `http://localhost:3000/**`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`
- `http://localhost:3000/invite/**`
