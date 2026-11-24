import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { getInvitationUrl } from '../lib/redirectUrl';
import type { Project, Task } from '../types/models';
import type {
  ProjectMember,
  ProjectInvitation,
  ProjectSharingSettings,
  SharedProjectView,
} from '../types/sharing';
import { mapProjectFromRow } from './projectService';
import { mapTaskFromRow } from './taskService';

/**
 * Utility to hash an invitation token with SHA-256 in browser or server runtime.
 */
export async function hashInvitationToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically strong random token for invitations.
 */
export function generateInvitationToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const sharingService = {
  /**
   * Fetches all members (invited and accepted) for a project.
   */
  async fetchProjectMembers(projectId: string): Promise<{ data: ProjectMember[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) return { data: null, error: error.message };

      const members: ProjectMember[] = (data || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        invitedEmail: row.invited_email,
        role: row.role as any,
        membershipStatus: row.membership_status as any,
        invitedBy: row.invited_by,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return { data: members, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch project members' };
    }
  },

  /**
   * Fetches pending invitations for a project.
   */
  async fetchProjectInvitations(projectId: string): Promise<{ data: ProjectInvitation[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      const { data, error } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };

      const invitations: ProjectInvitation[] = (data || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        invitedEmail: row.invited_email,
        tokenHash: row.token_hash,
        role: row.role as any,
        invitedBy: row.invited_by,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        deliveryStatus: (row.delivery_status as any) || 'queued',
        deliveryError: row.delivery_error || null,
        sentAt: row.sent_at || null,
        deliveryProviderMessageId: row.delivery_provider_message_id || null,
        resendCount: row.resend_count || 0,
      }));

      return { data: invitations, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch project invitations' };
    }
  },

  /**
   * Creates or resends a secure invitation and pending membership for a client.
   * Invokes the server-side send-client-invitation Edge Function to trigger actual email delivery.
   */
  async inviteClient(
    projectId: string,
    invitedEmail: string,
    personalMessage?: string,
    resend = false,
    isCopyLinkOnly = false
  ): Promise<{
    data: {
      invitation: ProjectInvitation;
      rawToken: string;
      inviteLink: string;
      emailDelivery: 'sent' | 'failed' | 'queued';
      deliveryError?: string | null;
      isCopyLinkOnly?: boolean;
    } | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    const email = invitedEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { data: null, error: 'Please enter a valid email address.' };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) return { data: null, error: 'Authentication required' };

      // 1. Invoke the secure server-side Edge Function to create invitation & dispatch email
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-client-invitation', {
          body: {
            projectId,
            invitedEmail: email,
            personalMessage,
            resend,
            isCopyLinkOnly,
          },
        });

        if (!fnErr && fnData?.success) {
          const inv: ProjectInvitation = {
            id: fnData.invitationId,
            projectId,
            invitedEmail: email,
            tokenHash: '',
            role: 'client',
            invitedBy: currentUserId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            acceptedAt: null,
            revokedAt: null,
            createdAt: new Date().toISOString(),
            deliveryStatus: fnData.emailDelivery || (isCopyLinkOnly ? 'queued' : 'failed'),
            deliveryError: fnData.deliveryError || null,
            sentAt: fnData.emailDelivery === 'sent' ? new Date().toISOString() : null,
            deliveryProviderMessageId: fnData.provider || null,
            resendCount: (resend && !isCopyLinkOnly) ? 1 : 0,
          };

          return {
            data: {
              invitation: inv,
              rawToken: fnData.rawToken,
              inviteLink: fnData.inviteLink,
              emailDelivery: fnData.emailDelivery || (isCopyLinkOnly ? 'queued' : 'failed'),
              deliveryError: fnData.deliveryError || null,
              isCopyLinkOnly: Boolean(fnData.isCopyLinkOnly),
            },
            error: null,
          };
        }

        if (fnErr) {
          console.warn('Edge function invoke returned error, falling back to direct RPC:', fnErr);
        }
      } catch (invokeEx) {
        console.warn('Failed to invoke send-client-invitation edge function:', invokeEx);
      }

      // 2. Direct atomic database RPC fallback
      const rawToken = generateInvitationToken();
      const tokenHash = await hashInvitationToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
        'rpc_create_or_resend_invitation',
        {
          p_project_id: projectId,
          p_invited_email: email,
          p_token_hash: tokenHash,
          p_expires_at: expiresAt,
          p_resend: resend || isCopyLinkOnly,
          p_increment_resend: Boolean(resend && !isCopyLinkOnly),
        }
      );

      if (rpcErr || !rpcRes?.success) {
        return { data: null, error: rpcErr?.message || rpcRes?.error || 'Failed to register invitation' };
      }

      const inviteLink = getInvitationUrl(rawToken);

      const invitation: ProjectInvitation = {
        id: rpcRes.invitation_id,
        projectId,
        invitedEmail: email,
        tokenHash,
        role: 'client',
        invitedBy: currentUserId,
        expiresAt,
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        deliveryStatus: isCopyLinkOnly ? 'queued' : 'failed',
        deliveryError: isCopyLinkOnly ? null : 'Email delivery function not reachable. Use direct copy link.',
        resendCount: (resend && !isCopyLinkOnly) ? 1 : 0,
      };

      return {
        data: {
          invitation,
          rawToken,
          inviteLink,
          emailDelivery: isCopyLinkOnly ? 'queued' : 'failed',
          deliveryError: isCopyLinkOnly
            ? null
            : 'Direct invitation link created. Email was not sent automatically.',
          isCopyLinkOnly,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to process invitation' };
    }
  },

  /**
   * Generates or reissues a secure invitation link without triggering email dispatch or incrementing resend count.
   */
  async reissueInvitationLink(projectId: string, invitedEmail: string) {
    return this.inviteClient(projectId, invitedEmail, undefined, true, true);
  },

  /**
   * Resends an existing project invitation with a fresh secure token and attempts email delivery.
   */
  async resendInvitation(
    projectId: string,
    invitedEmail: string,
    personalMessage?: string
  ) {
    return this.inviteClient(projectId, invitedEmail, personalMessage, true, false);
  },

  /**
   * Revokes a pending invitation atomically.
   */
  async revokeInvitation(invitationId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase client not configured' };

    try {
      const { data, error } = await (supabase.rpc as any)('rpc_revoke_project_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) return { success: false, error: error.message };
      if (!data?.success) return { success: false, error: data?.error || 'Failed to revoke invitation' };

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to revoke invitation' };
    }
  },

  /**
   * Removes an accepted client or revokes member access immediately.
   */
  async removeProjectMember(memberId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase client not configured' };

    try {
      const { error } = await supabase
        .from('project_members')
        .update({
          membership_status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove member' };
    }
  },

  /**
   * Fetches all projects shared with the authenticated user (Client Portal).
   */
  async fetchSharedProjects(userId: string): Promise<{ data: Project[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      // 1. Get accepted project IDs for this user
      const { data: memberships, error: memErr } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
        .eq('membership_status', 'accepted');

      if (memErr) return { data: null, error: memErr.message };

      const projectIds = (memberships || []).map((m: any) => m.project_id);
      if (projectIds.length === 0) {
        return { data: [], error: null };
      }

      // 2. Fetch permitted projects
      const { data: projectsData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (projErr) return { data: null, error: projErr.message };

      return {
        data: (projectsData || []).map(mapProjectFromRow),
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch shared projects' };
    }
  },

  /**
   * Looks up an invitation by raw token to preview invitation details before acceptance.
   * Leverages security definer RPC rpc_get_invitation_preview to bypass table RLS safely.
   */
  async getInvitationByToken(rawToken: string): Promise<{
    data: {
      invitation: ProjectInvitation;
      projectName: string;
      projectDescription?: string;
      invitedEmail: string;
    } | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      const tokenHash = await hashInvitationToken(rawToken);

      // Execute Security Definer RPC
      const { data: previewData, error: rpcErr } = await (supabase.rpc as any)(
        'rpc_get_invitation_preview',
        { p_token_hash: tokenHash }
      );

      if (rpcErr) {
        return { data: null, error: rpcErr.message };
      }

      if (!previewData || !previewData.found) {
        return { data: null, error: previewData?.error || 'Invitation not found or invalid link.' };
      }

      if (previewData.is_revoked) {
        return { data: null, error: 'This invitation has been revoked by the project owner.' };
      }

      if (previewData.is_accepted) {
        return { data: null, error: 'This invitation has already been accepted.' };
      }

      if (previewData.is_expired) {
        return { data: null, error: 'This invitation has expired. Please ask the project owner to resend it.' };
      }

      return {
        data: {
          invitation: {
            id: previewData.id,
            projectId: previewData.project_id,
            invitedEmail: previewData.invited_email,
            tokenHash,
            role: 'client',
            invitedBy: '',
            expiresAt: previewData.expires_at,
            acceptedAt: null,
            revokedAt: null,
            createdAt: '',
            deliveryStatus: 'sent',
            resendCount: 0,
          },
          projectName: previewData.project_name || 'Shared Project',
          projectDescription: previewData.project_description || undefined,
          invitedEmail: previewData.invited_email,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to inspect invitation' };
    }
  },

  /**
   * Accepts a project invitation using the raw token.
   * Leverages atomic security definer RPC rpc_accept_project_invitation to verify email,
   * update project_members, register client role in workspace_roles, and notify owner.
   */
  async acceptInvitation(rawToken: string): Promise<{ success: boolean; projectId?: string; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase client not configured' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      if (!currentUser) {
        return { success: false, error: 'You must be signed in to accept this invitation.' };
      }

      const tokenHash = await hashInvitationToken(rawToken);

      // Execute atomic Security Definer RPC
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
        'rpc_accept_project_invitation',
        { p_token_hash: tokenHash }
      );

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }

      if (!rpcRes || !rpcRes.success) {
        return { success: false, error: rpcRes?.error || 'Failed to accept invitation.' };
      }

      return { success: true, projectId: rpcRes.project_id, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to accept invitation' };
    }
  },

  /**
   * Updates project-level client sharing and progress visibility settings.
   */
  async updateSharingSettings(
    projectId: string,
    settings: Partial<ProjectSharingSettings>
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase client not configured' };

    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (settings.clientShareEnabled !== undefined) {
        updateData.client_share_enabled = settings.clientShareEnabled;
      }
      if (settings.clientViewTimeTracking !== undefined) {
        updateData.client_view_time_tracking = settings.clientViewTimeTracking;
      }
      if (settings.clientViewRemainingEstimate !== undefined) {
        updateData.client_view_remaining_estimate = settings.clientViewRemainingEstimate;
      }
      if (settings.clientViewTaskDates !== undefined) {
        updateData.client_view_task_dates = settings.clientViewTaskDates;
      }
      if (settings.clientAllowComments !== undefined) {
        updateData.client_allow_comments = settings.clientAllowComments;
      }
      if (settings.clientProjectStatus !== undefined) {
        updateData.client_project_status = settings.clientProjectStatus;
      }
      if (settings.targetCompletionDate !== undefined) {
        updateData.target_completion_date = settings.targetCompletionDate || null;
      }

      const { error } = await supabase
        .from('projects')
        .update(updateData as any)
        .eq('id', projectId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update sharing settings' };
    }
  },

  // ---------------------------------------------------------------------------
  // Aliases & Client Portal Helpers
  // ---------------------------------------------------------------------------

  async getProjectMembers(projectId: string) {
    return this.fetchProjectMembers(projectId);
  },

  async getProjectInvitations(projectId: string) {
    return this.fetchProjectInvitations(projectId);
  },

  async createInvitation(input: {
    projectId: string;
    email: string;
    role?: any;
    personalMessage?: string;
  }) {
    return this.inviteClient(
      input.projectId,
      input.email,
      input.personalMessage
    );
  },

  async updateProjectSharingSettings(
    projectId: string,
    settings: Partial<ProjectSharingSettings>
  ) {
    return this.updateSharingSettings(projectId, settings);
  },

  async getSharedProjectsForUser(): Promise<{
    data: SharedProjectView[] | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      if (!currentUser) return { data: [], error: null };

      const projectsRes = await this.fetchSharedProjects(currentUser.id);
      if (projectsRes.error || !projectsRes.data) {
        return { data: null, error: projectsRes.error };
      }

      const sharedProjects: SharedProjectView[] = [];

      for (const p of projectsRes.data) {
        const [tasksRes, timeRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('*')
            .eq('project_id', p.id)
            .eq('client_visible', true)
            .eq('is_archived', false),
          (supabase.rpc as any)('rpc_get_client_project_time_summary', {
            p_project_id: p.id,
          }),
        ]);

        const projectTasks = tasksRes.data || [];
        const completedTasks = projectTasks.filter((t: any) => t.status === 'completed');
        const remainingEst = projectTasks.reduce(
          (sum: number, t: any) => sum + (t.remaining_estimate_minutes || 0),
          0
        );
        const actualSecs = timeRes?.data?.total_actual_seconds || 0;

        sharedProjects.push({
          ...p,
          clientVisibleTaskCount: projectTasks.length,
          completedClientVisibleTaskCount: completedTasks.length,
          totalRemainingEstimateMinutes: remainingEst,
          totalActualSeconds: actualSecs,
        });
      }

      return { data: sharedProjects, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to get shared projects' };
    }
  },

  async getClientVisibleTasksForProject(projectId: string): Promise<{
    data: Task[] | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('client_visible', true)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

      if (error) return { data: null, error: error.message };

      return {
        data: (data || []).map(mapTaskFromRow),
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch client visible tasks' };
    }
  },
};
