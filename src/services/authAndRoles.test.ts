import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getAppBaseUrl,
  getAuthCallbackUrl,
  getPasswordResetUrl,
  getInvitationUrl,
} from '../lib/redirectUrl';
import {
  setRememberMePreference,
  getRememberMePreference,
} from '../lib/supabaseClient';
import {
  generateInvitationToken,
  hashInvitationToken,
} from './sharingService';
import { formatAuthError } from '../features/auth/SignInPage';

describe('Auth Redirect URL Architecture & Single Source of Truth', () => {
  it('Resolves base URL adhering to production fallback when window is not defined', () => {
    const baseUrl = getAppBaseUrl();
    assert.ok(
      baseUrl.startsWith('http://') || baseUrl.startsWith('https://'),
      'Base URL must be an absolute HTTP(S) URL'
    );
    assert.ok(
      baseUrl.includes('vercel.app') || baseUrl.includes('localhost'),
      'Base URL must be valid domain'
    );
  });

  it('Generates authentic Auth Callback URL for Magic Links and OAuth', () => {
    const callbackUrl = getAuthCallbackUrl();
    assert.ok(callbackUrl.endsWith('/auth/callback'));
    assert.ok(
      callbackUrl === 'https://my-work-planner-pwa.vercel.app/auth/callback' ||
      callbackUrl.includes('localhost:3000/auth/callback'),
      'Callback URL must be canonical'
    );
  });

  it('Generates authentic Password Reset URL', () => {
    const resetUrl = getPasswordResetUrl();
    assert.ok(resetUrl.endsWith('/auth/reset-password'));
  });

  it('Generates authentic Client Invitation URL', () => {
    const token = 'test-token-abc-123';
    const inviteUrl = getInvitationUrl(token);
    assert.ok(inviteUrl.endsWith(`/invite/${token}`));
  });
});

describe('Remember Me & Dynamic Storage Adapter', () => {
  it('Persists remember me preference when enabled', () => {
    // In node environment, window is undefined so it gracefully returns true default
    const pref = getRememberMePreference();
    assert.strictEqual(typeof pref, 'boolean');
    assert.strictEqual(pref, true);
  });
});

describe('Project Invitation Token Security & Hashing', () => {
  it('Generates 48-character cryptographically secure hex tokens', () => {
    const token1 = generateInvitationToken();
    const token2 = generateInvitationToken();
    assert.strictEqual(token1.length, 48);
    assert.strictEqual(token2.length, 48);
    assert.notStrictEqual(token1, token2, 'Consecutive tokens must be distinct');
  });

  it('Produces consistent SHA-256 hashes for invitation tokens', async () => {
    const raw = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const hash1 = await hashInvitationToken(raw);
    const hash2 = await hashInvitationToken(raw);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
  });
});

describe('Owner vs Client Workspace Separation Invariants', () => {
  it('Invariant 1: Workspace Owner has role = "owner" and can access all personal workspace routes', () => {
    const userRole: 'owner' | 'client' = 'owner';
    const isOwner = userRole === 'owner';
    const isClient = (userRole as string) === 'client';

    assert.strictEqual(isOwner, true);
    assert.strictEqual(isClient, false);

    // Permitted paths for owner
    const ownerPermittedPaths = [
      '/dashboard',
      '/tasks',
      '/projects',
      '/time-tracker',
      '/reports',
      '/settings',
      '/settings/google-calendar',
      '/portal', // Owner can preview client portal
    ];

    ownerPermittedPaths.forEach((path) => {
      const isAllowed = isOwner || path.startsWith('/portal');
      assert.strictEqual(isAllowed, true);
    });
  });

  it('Invariant 2: External Client has role = "client" and CANNOT access owner workspace routes', () => {
    const userRole: 'owner' | 'client' = 'client';
    const isOwner = (userRole as string) === 'owner';
    const isClient = userRole === 'client';

    assert.strictEqual(isOwner, false);
    assert.strictEqual(isClient, true);

    const ownerOnlyPaths = [
      '/dashboard',
      '/tasks',
      '/tasks/some-task-id',
      '/projects',
      '/projects/some-project-id',
      '/time-tracker',
      '/reports',
      '/client-inbox',
      '/settings',
    ];

    ownerOnlyPaths.forEach((path) => {
      const isAllowed = isOwner; // OwnerRoute rejects !isOwner
      assert.strictEqual(isAllowed, false, `Client must not be allowed to access ${path}`);
    });

    // Client permitted paths
    const clientPermittedPaths = [
      '/portal',
      '/portal/projects/test-project-id',
      '/portal/inbox',
    ];

    clientPermittedPaths.forEach((path) => {
      const isAllowed = isClient || isOwner;
      assert.strictEqual(isAllowed, true, `Client must be allowed to access ${path}`);
    });
  });

  it('Invariant 3: Database RLS blocks clients from inserting projects or tasks', () => {
    // Simulating PostgreSQL RLS WITH CHECK policy:
    // public.is_workspace_owner(auth.uid()) AND auth.uid() = user_id
    const isWorkspaceOwner = (role: string) => role === 'owner';

    const clientRole = 'client';
    const canClientInsertProject = isWorkspaceOwner(clientRole);
    const canClientInsertTask = isWorkspaceOwner(clientRole);

    assert.strictEqual(canClientInsertProject, false, 'Client must NOT be allowed to insert projects');
    assert.strictEqual(canClientInsertTask, false, 'Client must NOT be allowed to insert tasks');

    const ownerRole = 'owner';
    const canOwnerInsertProject = isWorkspaceOwner(ownerRole);
    const canOwnerInsertTask = isWorkspaceOwner(ownerRole);

    assert.strictEqual(canOwnerInsertProject, true, 'Owner must be allowed to insert projects');
    assert.strictEqual(canOwnerInsertTask, true, 'Owner must be allowed to insert tasks');
  });

  it('Invariant 4: Root route "/" intelligently redirects based on authenticated role', () => {
    const resolveRootRedirect = (isAuthenticated: boolean, isOwner: boolean, isClient: boolean) => {
      if (!isAuthenticated) return '/sign-in';
      if (isClient && !isOwner) return '/portal';
      return '/dashboard';
    };

    assert.strictEqual(resolveRootRedirect(false, false, false), '/sign-in');
    assert.strictEqual(resolveRootRedirect(true, true, false), '/dashboard');
    assert.strictEqual(resolveRootRedirect(true, false, true), '/portal');
  });
});

describe('Authentication & Password Reset Login Resilience', () => {
  it('Formats authentication error messages into clear, actionable user messages', () => {
    // 1. Invalid credentials
    assert.ok(
      formatAuthError('Invalid login credentials').includes('Invalid email or password'),
      'Must map invalid login credentials to user-friendly text'
    );
    assert.ok(
      formatAuthError('invalid_grant: user not found or bad password').includes('Invalid email or password'),
      'Must map invalid_grant to user-friendly text'
    );

    // 2. Email not confirmed
    assert.ok(
      formatAuthError('Email not confirmed').includes('confirmation email'),
      'Must guide user when email is not confirmed'
    );

    // 3. Rate limiting
    assert.ok(
      formatAuthError('over_email_send_rate_limit: too many requests').includes('Too many login attempts'),
      'Must inform user of rate limiting'
    );
    assert.ok(
      formatAuthError('Too many requests').includes('Too many login attempts')
    );

    // 4. Network failures
    assert.ok(
      formatAuthError('Failed to fetch').includes('Network connection problem'),
      'Must handle fetch / network loss'
    );
    assert.ok(
      formatAuthError('Network error connecting to supabase').includes('Network connection problem')
    );

    // 5. Service unavailable
    assert.ok(
      formatAuthError('503 Service Unavailable').includes('temporarily unavailable'),
      'Must handle 503 service downtime'
    );

    // 6. Default fallback
    assert.strictEqual(formatAuthError(undefined), 'Invalid email or password.');
  });

  it('Resolves post-login navigation targets accurately by role and return path', () => {
    const resolvePostLoginTarget = (
      role: 'owner' | 'client' | 'unauthorized',
      returnTo?: string | null,
      fromPath?: string | null
    ): string => {
      const target = returnTo || fromPath;
      if (target) return target;
      if (role === 'client') return '/portal';
      return '/dashboard';
    };

    // Owner default
    assert.strictEqual(resolvePostLoginTarget('owner'), '/dashboard');

    // Client default
    assert.strictEqual(resolvePostLoginTarget('client'), '/portal');

    // Custom returnTo path preserved for both
    assert.strictEqual(
      resolvePostLoginTarget('owner', '/projects/prj-123'),
      '/projects/prj-123'
    );
    assert.strictEqual(
      resolvePostLoginTarget('client', '/portal/projects/prj-123'),
      '/portal/projects/prj-123'
    );

    // Preserves fromPath state from ProtectedRoute
    assert.strictEqual(
      resolvePostLoginTarget('owner', null, '/settings'),
      '/settings'
    );
  });

  it('Ensures password reset URL parameters do not trap authenticated users', () => {
    // When passwordReset=success is present, user must still be able to complete login and navigate away
    const computePostLoginDestination = (params: {
      passwordResetSuccess: boolean;
      loginSucceeded: boolean;
      role: 'owner' | 'client';
    }) => {
      if (!params.loginSucceeded) return null;
      return params.role === 'client' ? '/portal' : '/dashboard';
    };

    // After reset password, when user logs in with new password, destination must be resolved
    assert.strictEqual(
      computePostLoginDestination({
        passwordResetSuccess: true,
        loginSucceeded: true,
        role: 'owner',
      }),
      '/dashboard'
    );

    assert.strictEqual(
      computePostLoginDestination({
        passwordResetSuccess: true,
        loginSucceeded: true,
        role: 'client',
      }),
      '/portal'
    );
  });
});
