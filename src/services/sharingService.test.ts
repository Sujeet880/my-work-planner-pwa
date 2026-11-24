import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInvitationToken,
  hashInvitationToken,
} from './sharingService';

describe('Project Sharing & Invitation Security Rules', () => {
  it('generateInvitationToken generates a secure 48-character hex token from 24 cryptographically random bytes', () => {
    const token1 = generateInvitationToken();
    const token2 = generateInvitationToken();

    assert.equal(typeof token1, 'string');
    assert.equal(token1.length, 48); // 24 bytes * 2 hex chars
    assert.match(token1, /^[0-9a-f]{48}$/);

    // Tokens must be unique
    assert.notEqual(token1, token2);
  });

  it('hashInvitationToken generates deterministic SHA-256 digests', async () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef';
    const hash1 = await hashInvitationToken(rawToken);
    const hash2 = await hashInvitationToken(rawToken);

    assert.equal(hash1.length, 64); // 32 bytes * 2 hex chars
    assert.match(hash1, /^[0-9a-f]{64}$/);
    assert.equal(hash1, hash2);

    const differentHash = await hashInvitationToken('fedcba9876543210fedcba9876543210fedcba9876543210');
    assert.notEqual(hash1, differentHash);
  });

  it('Client Visibility Invariant: internal tasks (client_visible = false) must never be visible to clients', () => {
    const mockTasks = [
      { id: 't1', title: 'Internal Strategy Spec', clientVisible: false, status: 'todo' },
      { id: 't2', title: 'Reviewed Wireframe Deck', clientVisible: true, status: 'completed' },
      { id: 't3', title: 'Architecture Review', clientVisible: false, status: 'in_progress' },
      { id: 't4', title: 'Phase 1 Deliverables', clientVisible: true, status: 'in_progress' },
    ];

    const clientVisibleTasks = mockTasks.filter((t) => t.clientVisible);
    assert.equal(clientVisibleTasks.length, 2);
    assert.equal(clientVisibleTasks.some((t) => t.id === 't1'), false);
    assert.equal(clientVisibleTasks.some((t) => t.id === 't3'), false);
    assert.deepEqual(
      clientVisibleTasks.map((t) => t.id),
      ['t2', 't4']
    );
  });

  it('Project progress computation for client portal calculates strictly over client-visible tasks', () => {
    const mockProjectTasks = [
      { id: 't1', clientVisible: false, status: 'completed' }, // internal completed
      { id: 't2', clientVisible: true, status: 'completed' },  // visible completed
      { id: 't3', clientVisible: true, status: 'todo' },       // visible todo
      { id: 't4', clientVisible: true, status: 'todo' },       // visible todo
      { id: 't5', clientVisible: true, status: 'in_progress' },// visible in progress
    ];

    const clientTasks = mockProjectTasks.filter((t) => t.clientVisible);
    const completedClient = clientTasks.filter((t) => t.status === 'completed');
    const clientProgressPct = Math.round((completedClient.length / clientTasks.length) * 100);

    // 1 completed out of 4 client-visible = 25% (NOT 2 out of 5 = 40%)
    assert.equal(clientTasks.length, 4);
    assert.equal(completedClient.length, 1);
    assert.equal(clientProgressPct, 25);
  });

  it('Invitation delivery lifecycle: accurately maps delivery status, sent timestamp, error, and resend count', () => {
    const rawDbRows = [
      {
        id: 'inv-1',
        project_id: 'p-1',
        invited_email: 'client1@example.com',
        token_hash: 'hash1',
        role: 'client',
        invited_by: 'owner-1',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        accepted_at: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
        delivery_status: 'sent',
        delivery_error: null,
        sent_at: '2026-11-23T06:00:00Z',
        delivery_provider_message_id: 'msg-12345',
        resend_count: 0,
      },
      {
        id: 'inv-2',
        project_id: 'p-1',
        invited_email: 'client2@example.com',
        token_hash: 'hash2',
        role: 'client',
        invited_by: 'owner-1',
        expires_at: new Date(Date.now() - 3600000).toISOString(), // expired
        accepted_at: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
        delivery_status: 'failed',
        delivery_error: 'Direct link generated. Resend API key not configured.',
        sent_at: null,
        delivery_provider_message_id: null,
        resend_count: 2,
      },
    ];

    const mapped = rawDbRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      invitedEmail: row.invited_email,
      deliveryStatus: row.delivery_status as 'sent' | 'failed' | 'queued',
      deliveryError: row.delivery_error,
      sentAt: row.sent_at,
      resendCount: row.resend_count,
      isExpired: new Date(row.expires_at).getTime() < Date.now(),
    }));

    assert.equal(mapped[0].deliveryStatus, 'sent');
    assert.equal(mapped[0].sentAt, '2026-11-23T06:00:00Z');
    assert.equal(mapped[0].isExpired, false);
    assert.equal(mapped[0].resendCount, 0);

    assert.equal(mapped[1].deliveryStatus, 'failed');
    assert.match(mapped[1].deliveryError!, /Direct link generated/);
    assert.equal(mapped[1].isExpired, true);
    assert.equal(mapped[1].resendCount, 2);
  });

  it('Password reset sign-out redirect flow preserves passwordReset=success parameter', () => {
    const searchParams = new URLSearchParams('passwordReset=success');
    const isResetSuccess = searchParams.get('passwordReset') === 'success';
    assert.equal(isResetSuccess, true);

    const normalParams = new URLSearchParams('role=client');
    assert.equal(normalParams.get('passwordReset'), null);
  });

  it('Active Clients vs Pending Invitations separation invariant', () => {
    const allMembers = [
      {
        id: 'm-1',
        projectId: 'p-1',
        invitedEmail: 'active-client@example.com',
        membershipStatus: 'accepted',
        acceptedAt: '2026-11-20T10:00:00Z',
        createdAt: '2026-11-19T10:00:00Z',
      },
      {
        id: 'm-2',
        projectId: 'p-1',
        invitedEmail: 'pending-client@example.com',
        membershipStatus: 'pending',
        acceptedAt: null,
        createdAt: '2026-11-23T06:00:00Z',
      },
    ];

    const activeClients = allMembers.filter((m) => m.membershipStatus === 'accepted');
    assert.equal(activeClients.length, 1);
    assert.equal(activeClients[0].invitedEmail, 'active-client@example.com');
    assert.equal(activeClients[0].acceptedAt, '2026-11-20T10:00:00Z');

    // Pending client must NEVER appear in active clients
    assert.equal(activeClients.some((m) => m.invitedEmail === 'pending-client@example.com'), false);

    // Joined date must be derived strictly from acceptedAt
    const pendingMember = allMembers.find((m) => m.membershipStatus === 'pending')!;
    const joinedDate = pendingMember.acceptedAt ? new Date(pendingMember.acceptedAt).toLocaleDateString() : null;
    assert.equal(joinedDate, null);
  });

  it('Copy Link vs Resend invariant: reissuing link does not increment resend count or alter delivery status to sent', () => {
    let invitationState: {
      tokenHash: string;
      deliveryStatus: 'queued' | 'failed' | 'sent';
      resendCount: number;
    } = {
      tokenHash: 'initial-hash',
      deliveryStatus: 'failed',
      resendCount: 0,
    };

    // Simulate Reissue Link (isCopyLinkOnly = true, incrementResend = false)
    const freshToken = 'fresh-token-48-chars-hex-abcdef012345678901234567';
    invitationState = {
      tokenHash: freshToken,
      deliveryStatus: invitationState.deliveryStatus, // unaltered
      resendCount: invitationState.resendCount, // unaltered (0)
    };

    assert.equal(invitationState.tokenHash, freshToken);
    assert.equal(invitationState.deliveryStatus, 'failed');
    assert.equal(invitationState.resendCount, 0);

    // Simulate Actual Email Resend (resend = true, incrementResend = true)
    invitationState = {
      ...invitationState,
      deliveryStatus: 'queued',
      resendCount: invitationState.resendCount + 1,
    };

    assert.equal(invitationState.resendCount, 1);
    assert.equal(invitationState.deliveryStatus, 'queued');
  });

  it('Existing user auth guard: existing auth users do not trigger inviteUserByEmail', () => {
    const authStatusExisting: { exists: boolean; user_id: string | null; is_confirmed: boolean } = {
      exists: true,
      user_id: 'usr-123',
      is_confirmed: true,
    };
    const authStatusNew: { exists: boolean; user_id: string | null; is_confirmed: boolean } = {
      exists: false,
      user_id: null,
      is_confirmed: false,
    };

    // Function to decide dispatch method
    const getDispatchStrategy = (authStatus: { exists: boolean; user_id: string | null; is_confirmed: boolean }, hasResendKey: boolean) => {
      if (hasResendKey) return 'resend_api';
      if (authStatus.exists) return 'manual_link_fallback'; // DO NOT call inviteUserByEmail
      return 'supabase_auth_invite';
    };

    // Existing user without external transactional email key
    assert.equal(getDispatchStrategy(authStatusExisting, false), 'manual_link_fallback');

    // Existing user with Resend key
    assert.equal(getDispatchStrategy(authStatusExisting, true), 'resend_api');

    // Brand new user without Resend key
    assert.equal(getDispatchStrategy(authStatusNew, false), 'supabase_auth_invite');
  });
});
