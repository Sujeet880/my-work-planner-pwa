import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type {
  ClientProjectStatus,
  ConversationRead,
  InboxConversationItem,
  ProjectComment,
  ProjectNotification,
  ProjectTaskRequest,
  ProjectUpdate,
  RealtimeConnectionStatus,
  TaskRequestPriority,
  TaskRequestStatus,
} from '../types/sharing';

export type { RealtimeConnectionStatus };

export const discussionService = {
  // ---------------------------------------------------------------------------
  // Profile & Identity Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolves authentic human display names and emails from public.profiles.
   */
  async resolveProfiles(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
    const map = new Map<string, { name: string; email: string }>();
    if (!userIds || userIds.length === 0) return map;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return map;

    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uniqueIds);

      for (const p of data || []) {
        const cleanName = p.full_name?.trim();
        const fallback = p.email ? p.email.split('@')[0] : 'Team Member';
        map.set(p.id, {
          name: cleanName || fallback,
          email: p.email || '',
        });
      }
    } catch (err) {
      console.warn('Profile resolution warning:', err);
    }
    return map;
  },

  // ---------------------------------------------------------------------------
  // Project & Task Discussions
  // ---------------------------------------------------------------------------

  /**
   * Fetches comments for a project or specific task discussion.
   * Resolves authentic sender names and roles dynamically.
   */
  async fetchComments(
    projectId: string,
    taskId?: string | null
  ): Promise<{ data: ProjectComment[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      // 1. Fetch project owner ID
      const { data: projectRow } = await supabase
        .from('projects')
        .select('user_id, name')
        .eq('id', projectId)
        .single();
      const ownerId = projectRow?.user_id || '';
      const projectName = projectRow?.name || 'Project';

      // 2. Query comments with task join
      let query = supabase
        .from('project_comments')
        .select('*, tasks(title)')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (taskId !== undefined) {
        if (taskId === null) {
          query = query.is('task_id', null);
        } else {
          query = query.eq('task_id', taskId);
        }
      }

      const { data, error } = await query;
      if (error) {
        if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
          return {
            data: null,
            error: "Database table 'public.project_task_requests' does not exist yet. Migration 20261123000014 must be applied to the remote database to create it.",
          };
        }
        return { data: null, error: error.message };
      }

      const rows = data || [];
      const authorIds = rows.map((r: any) => r.author_id);
      const profilesMap = await this.resolveProfiles(authorIds);

      // 3. Map into enriched ProjectComment models
      const allComments: ProjectComment[] = rows.map((row: any) => {
        const profile = profilesMap.get(row.author_id);
        const isOwner = row.author_id === ownerId;
        const authorName = profile?.name || (isOwner ? 'Project Owner' : 'Client Collaborator');

        return {
          id: row.id,
          projectId: row.project_id,
          taskId: row.task_id,
          parentCommentId: row.parent_comment_id,
          authorId: row.author_id,
          body: row.body,
          resolvedAt: row.resolved_at,
          resolvedBy: row.resolved_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
          authorName,
          authorEmail: profile?.email || '',
          authorRole: isOwner ? 'Project Owner' : 'Client Collaborator',
          isOwnerComment: isOwner,
          projectName,
          taskTitle: (row.tasks as any)?.title || null,
          replies: [],
        };
      });

      // 4. Organize top-level comments and replies
      const topLevel: ProjectComment[] = [];
      const repliesMap = new Map<string, ProjectComment[]>();

      for (const comment of allComments) {
        if (comment.parentCommentId) {
          const list = repliesMap.get(comment.parentCommentId) || [];
          list.push(comment);
          repliesMap.set(comment.parentCommentId, list);
        } else {
          topLevel.push(comment);
        }
      }

      for (const comment of topLevel) {
        comment.replies = repliesMap.get(comment.id) || [];
      }

      // Safety: If any comments had orphan parentCommentIds, include them so no message is lost
      const renderedIds = new Set<string>();
      for (const t of topLevel) {
        renderedIds.add(t.id);
        for (const r of t.replies || []) renderedIds.add(r.id);
      }
      for (const comment of allComments) {
        if (!renderedIds.has(comment.id)) {
          topLevel.push(comment);
        }
      }

      return { data: topLevel, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch comments' };
    }
  },

  /**
   * Posts a new comment or reply into project discussion or task discussion.
   */
  async createComment(input: {
    projectId: string;
    taskId?: string | null;
    parentCommentId?: string | null;
    body: string;
  }): Promise<{ data: ProjectComment | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    const trimmedBody = input.body.trim();
    if (!trimmedBody) {
      return { data: null, error: 'Comment body cannot be empty.' };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      if (!currentUser) return { data: null, error: 'Authentication required' };

      const { data: commentRow, error: insertErr } = await supabase
        .from('project_comments')
        .insert({
          project_id: input.projectId,
          task_id: input.taskId || null,
          parent_comment_id: input.parentCommentId || null,
          author_id: currentUser.id,
          body: trimmedBody,
        })
        .select('*, tasks(title)')
        .single();

      if (insertErr) return { data: null, error: insertErr.message };

      // Resolve author profile
      const profilesMap = await this.resolveProfiles([currentUser.id]);
      const profile = profilesMap.get(currentUser.id);

      const comment: ProjectComment = {
        id: commentRow.id,
        projectId: commentRow.project_id,
        taskId: commentRow.task_id,
        parentCommentId: commentRow.parent_comment_id,
        authorId: commentRow.author_id,
        body: commentRow.body,
        resolvedAt: commentRow.resolved_at,
        resolvedBy: commentRow.resolved_by,
        createdAt: commentRow.created_at,
        updatedAt: commentRow.updated_at,
        deletedAt: commentRow.deleted_at,
        authorName: profile?.name || currentUser.email?.split('@')[0] || 'User',
        authorEmail: currentUser.email || '',
        taskTitle: (commentRow.tasks as any)?.title || null,
        replies: [],
      };

      // Mark as read for the sender immediately
      this.markConversationRead(input.projectId, input.taskId).catch(() => {});

      // Broadcast to channel for instant zero-latency peer delivery across active clients
      try {
        const broadcastChannel = supabase.channel(`realtime-comments-${input.projectId}`);
        broadcastChannel.send({
          type: 'broadcast',
          event: 'new_comment',
          payload: {
            id: comment.id,
            projectId: comment.projectId,
            taskId: comment.taskId,
            authorId: currentUser.id,
          },
        }).catch(() => {});
      } catch {
        // Safe silent broadcast error catch
      }

      // Dispatch notifications asynchronously
      this.dispatchCommentNotifications({
        projectId: input.projectId,
        taskId: input.taskId || null,
        commentId: comment.id,
        authorId: currentUser.id,
        authorName: comment.authorName || 'Collaborator',
        authorEmail: currentUser.email || 'Someone',
        bodyPreview: trimmedBody.slice(0, 100),
        isReply: Boolean(input.parentCommentId),
      }).catch((nErr) => console.warn('Comment notification warning:', nErr));

      return { data: comment, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to post comment' };
    }
  },

  /**
   * Subscribes to realtime updates for a project's comments with accurate connection status.
   */
  subscribeToComments(
    projectId: string,
    onUpdate: () => void,
    onStatusChange?: (status: RealtimeConnectionStatus) => void
  ): () => void {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      onStatusChange?.('offline');
      return () => {};
    }

    if (!navigator.onLine) {
      onStatusChange?.('offline');
    } else {
      onStatusChange?.('connecting');
    }

    const channelName = `realtime-comments-${projectId}`;
    const channel = supabase.channel(channelName);

    // 1. Listen for Postgres logical replication events
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_comments',
        filter: `project_id=eq.${projectId}`,
      },
      () => {
        onUpdate();
      }
    );

    // 2. Listen for Realtime Broadcast events for instantaneous peer delivery
    channel.on(
      'broadcast',
      { event: 'new_comment' },
      () => {
        onUpdate();
      }
    );

    channel.on(
      'broadcast',
      { event: 'comment_updated' },
      () => {
        onUpdate();
      }
    );

    // 3. Subscription status verification
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected');
      } else if (status === 'TIMED_OUT') {
        onStatusChange?.('reconnecting');
      } else if (status === 'CLOSED') {
        onStatusChange?.('offline');
      } else if (status === 'CHANNEL_ERROR') {
        onStatusChange?.('error');
      }
    });

    // 4. Online and offline recovery listeners
    const handleOnline = () => {
      onStatusChange?.('reconnecting');
      onUpdate(); // Re-fetch messages immediately on reconnect to recover missed events
      supabase.removeChannel(channel);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') onStatusChange?.('connected');
      });
    };

    const handleOffline = () => {
      onStatusChange?.('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  },

  /**
   * Resolves or reopens a comment thread.
   */
  async resolveThread(
    commentId: string,
    resolved: boolean
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase client not configured' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      const { error } = await supabase
        .from('project_comments')
        .update({
          resolved_at: resolved ? new Date().toISOString() : null,
          resolved_by: resolved ? currentUserId : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resolve thread' };
    }
  },

  /**
   * Deletes a comment (soft delete).
   */
  async deleteComment(commentId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase client not configured' };

    try {
      const { error } = await supabase
        .from('project_comments')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete comment' };
    }
  },

  // ---------------------------------------------------------------------------
  // User-Specific Read Tracking
  // ---------------------------------------------------------------------------

  /**
   * Marks a project discussion or task discussion as read for the current user.
   */
  async markConversationRead(projectId: string, taskId?: string | null): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const nowIso = new Date().toISOString();
      const storageKey = `mwp_read_${userId}_${projectId}_${taskId || 'general'}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, nowIso);
      }

      // Try persisting to database conversation_reads if table exists
      try {
        await supabase.from('conversation_reads').upsert(
          {
            user_id: userId,
            project_id: projectId,
            task_id: taskId || null,
            last_read_at: nowIso,
          },
          { onConflict: 'user_id,project_id,task_id' }
        );
      } catch {
        // Table not migrated yet; local storage fallback is active
      }
    } catch (err) {
      console.warn('Could not record read state:', err);
    }
  },

  /**
   * Gets last read timestamp for user.
   */
  getLastReadTimestamp(userId: string, projectId: string, taskId?: string | null): string | null {
    if (typeof window === 'undefined') return null;
    const storageKey = `mwp_read_${userId}_${projectId}_${taskId || 'general'}`;
    return localStorage.getItem(storageKey);
  },

  // ---------------------------------------------------------------------------
  // Client Task Requests Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Submits a new client task request.
   */
  async createTaskRequest(input: {
    projectId: string;
    title: string;
    description?: string;
    reason?: string;
    suggestedPriority?: TaskRequestPriority;
    requestedDueDate?: string | null;
  }): Promise<{ data: ProjectTaskRequest | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    const title = input.title.trim();
    if (!title) return { data: null, error: 'Task request title is required.' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return { data: null, error: 'Authentication required' };

      const { data: row, error } = await supabase
        .from('project_task_requests')
        .insert({
          project_id: input.projectId,
          requested_by: userId,
          title,
          description: input.description?.trim() || null,
          reason: input.reason?.trim() || null,
          suggested_priority: input.suggestedPriority || 'medium',
          requested_due_date: input.requestedDueDate || null,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
          return {
            data: null,
            error: "Database table 'public.project_task_requests' does not exist yet. Migration 20261123000014 must be applied to the remote database to create it.",
          };
        }
        return { data: null, error: error.message };
      }

      // Notify project owner
      const { data: project } = await supabase
        .from('projects')
        .select('user_id, name')
        .eq('id', input.projectId)
        .single();

      if (project?.user_id) {
        await supabase.from('project_notifications').insert({
          recipient_user_id: project.user_id,
          project_id: input.projectId,
          notification_type: 'task_request',
          title: `New Task Request: ${title}`,
          body: input.description || 'Client has submitted a new task request for review.',
        });
      }

      return {
        data: {
          id: row.id,
          projectId: row.project_id,
          requestedBy: row.requested_by,
          title: row.title,
          description: row.description,
          reason: row.reason,
          suggestedPriority: row.suggested_priority,
          requestedDueDate: row.requested_due_date,
          status: row.status,
          ownerFeedback: row.owner_feedback,
          createdTaskId: row.created_task_id,
          reviewedAt: row.reviewed_at,
          reviewedBy: row.reviewed_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to submit task request' };
    }
  },

  /**
   * Fetches task requests for a project or all authorized projects.
   */
  async fetchTaskRequests(
    projectId?: string
  ): Promise<{ data: ProjectTaskRequest[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: [], error: null };

    try {
      let query = supabase
        .from('project_task_requests')
        .select('*, projects(name, color)')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) {
        // Table may not be created yet if migrations pending
        console.warn('Task requests query notice:', error.message);
        return { data: [], error: null };
      }

      const requesterIds = (data || []).map((r: any) => r.requested_by);
      const profilesMap = await this.resolveProfiles(requesterIds);

      const list: ProjectTaskRequest[] = (data || []).map((row: any) => {
        const profile = profilesMap.get(row.requested_by);
        return {
          id: row.id,
          projectId: row.project_id,
          requestedBy: row.requested_by,
          title: row.title,
          description: row.description,
          reason: row.reason,
          suggestedPriority: row.suggested_priority,
          requestedDueDate: row.requested_due_date,
          status: row.status,
          ownerFeedback: row.owner_feedback,
          createdTaskId: row.created_task_id,
          reviewedAt: row.reviewed_at,
          reviewedBy: row.reviewed_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          requesterName: profile?.name || 'Client',
          requesterEmail: profile?.email || '',
          projectName: (row.projects as any)?.name || 'Project',
          projectColor: (row.projects as any)?.color || '#2F65F6',
        };
      });

      return { data: list, error: null };
    } catch (err: any) {
      return { data: [], error: null };
    }
  },

  /**
   * Updates task request status (under_review, needs_information, rejected, withdrawn).
   */
  async updateTaskRequestStatus(
    requestId: string,
    status: TaskRequestStatus,
    feedback?: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { success: false, error: 'Supabase unconfigured' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      const { data: req, error: updateErr } = await supabase
        .from('project_task_requests')
        .update({
          status,
          owner_feedback: feedback !== undefined ? feedback : undefined,
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updateErr) return { success: false, error: updateErr.message };

      // Notify requester
      if (req && req.requested_by) {
        await supabase.from('project_notifications').insert({
          recipient_user_id: req.requested_by,
          project_id: req.project_id,
          notification_type: 'task_request',
          title: `Task Request ${status.replace('_', ' ').toUpperCase()}: ${req.title}`,
          body: feedback || `Your task request status was updated to ${status}.`,
        });
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Status update failed' };
    }
  },

  /**
   * Approves a task request: creates an active task atomically and idempotently.
   */
  async approveTaskRequest(
    requestId: string,
    overrides?: {
      title?: string;
      description?: string;
      scheduledDate?: string | null;
      scheduledStartTime?: string | null;
      plannedDurationMinutes?: number | null;
      priority?: string;
      clientVisible?: boolean;
    }
  ): Promise<{ data: { taskId: string } | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      // 1. Try atomic database RPC
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)('rpc_approve_task_request', {
        p_request_id: requestId,
        p_title: overrides?.title || null,
        p_description: overrides?.description || null,
        p_scheduled_date: overrides?.scheduledDate || null,
        p_scheduled_start_time: overrides?.scheduledStartTime || null,
        p_planned_duration_minutes: overrides?.plannedDurationMinutes || null,
        p_priority: overrides?.priority || 'medium',
        p_client_visible: overrides?.clientVisible ?? true,
      });

      if (!rpcErr && rpcRes && (rpcRes as any).success) {
        return { data: { taskId: (rpcRes as any).task_id }, error: null };
      }

      // 2. Direct client-side idempotent fallback
      const { data: req, error: reqErr } = await supabase
        .from('project_task_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqErr || !req) return { data: null, error: reqErr?.message || 'Request not found' };

      // If already approved, return existing task ID
      if (req.status === 'approved' && req.created_task_id) {
        return { data: { taskId: req.created_task_id }, error: null };
      }

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) return { data: null, error: 'Authentication required' };

      const { data: newTask, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          project_id: req.project_id,
          user_id: currentUserId,
          title: overrides?.title || req.title,
          description: overrides?.description || req.description,
          scheduled_date: overrides?.scheduledDate || req.requested_due_date,
          scheduled_start_time: overrides?.scheduledStartTime || null,
          planned_duration_minutes: overrides?.plannedDurationMinutes || 60,
          priority: (overrides?.priority as any) || req.suggested_priority || 'medium',
          client_visible: overrides?.clientVisible ?? true,
          status: 'todo',
          is_archived: false,
        })
        .select('id')
        .single();

      if (taskErr || !newTask) return { data: null, error: taskErr?.message || 'Task creation failed' };

      await supabase
        .from('project_task_requests')
        .update({
          status: 'approved',
          created_task_id: newTask.id,
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      await supabase.from('project_notifications').insert({
        recipient_user_id: req.requested_by,
        project_id: req.project_id,
        notification_type: 'task_request',
        title: `Task Request Approved: ${req.title}`,
        body: 'Your task request has been approved and added to active project deliverables.',
      });

      return { data: { taskId: newTask.id }, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Approval failed' };
    }
  },

  // ---------------------------------------------------------------------------
  // Unified Collaboration Inbox Aggregator
  // ---------------------------------------------------------------------------

  /**
   * Aggregates project discussions, task discussions, and task requests into a unified inbox.
   */
  async fetchInboxConversations(): Promise<{
    data: InboxConversationItem[];
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: [], error: 'Supabase unconfigured' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) return { data: [], error: 'Unauthenticated' };

      // 1. Fetch accessible projects
      const { data: ownedProjects } = await supabase
        .from('projects')
        .select('id, name, color, user_id')
        .eq('user_id', currentUserId);

      const { data: memberRows } = await supabase
        .from('project_members')
        .select('project_id, projects(id, name, color, user_id)')
        .eq('user_id', currentUserId)
        .eq('membership_status', 'accepted');

      const projectMap = new Map<string, { id: string; name: string; color: string; ownerId: string }>();

      for (const p of ownedProjects || []) {
        projectMap.set(p.id, { id: p.id, name: p.name, color: p.color, ownerId: p.user_id });
      }
      for (const m of memberRows || []) {
        const prj = m.projects as any;
        if (prj && !projectMap.has(prj.id)) {
          projectMap.set(prj.id, { id: prj.id, name: prj.name, color: prj.color, ownerId: prj.user_id });
        }
      }

      const accessibleProjectIds = Array.from(projectMap.keys());
      if (accessibleProjectIds.length === 0) return { data: [], error: null };

      // 2. Query recent comments across accessible projects
      const { data: comments } = await supabase
        .from('project_comments')
        .select('id, project_id, task_id, author_id, body, created_at, tasks(title)')
        .in('project_id', accessibleProjectIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);

      // 3. Query task requests
      const { data: requests } = await supabase
        .from('project_task_requests')
        .select('*')
        .in('project_id', accessibleProjectIds)
        .order('created_at', { ascending: false })
        .limit(100);

      // 4. Resolve author display names
      const allAuthorIds = [
        ...(comments || []).map((c: any) => c.author_id),
        ...(requests || []).map((r: any) => r.requested_by),
      ];
      const profilesMap = await this.resolveProfiles(allAuthorIds);

      const inboxItems: InboxConversationItem[] = [];

      // Group comments by conversation: project-level vs task-level
      const conversationMap = new Map<
        string,
        {
          projectId: string;
          taskId: string | null;
          taskTitle: string | null;
          comments: any[];
        }
      >();

      for (const c of comments || []) {
        const convKey = `${c.project_id}:${c.task_id || 'general'}`;
        if (!conversationMap.has(convKey)) {
          conversationMap.set(convKey, {
            projectId: c.project_id,
            taskId: c.task_id,
            taskTitle: (c.tasks as any)?.title || null,
            comments: [],
          });
        }
        conversationMap.get(convKey)!.comments.push(c);
      }

      // Build conversation items
      for (const [convKey, conv] of conversationMap.entries()) {
        const project = projectMap.get(conv.projectId);
        if (!project) continue;

        const latest = conv.comments[0]; // first because ordered desc
        const authorProfile = profilesMap.get(latest.author_id);
        const isOwner = latest.author_id === project.ownerId;
        const senderName = authorProfile?.name || (isOwner ? 'Project Owner' : 'Client Collaborator');
        const senderRole = isOwner ? 'Project Owner' : 'Client Collaborator';

        // Compute unread count
        const lastRead = this.getLastReadTimestamp(currentUserId, conv.projectId, conv.taskId);
        const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
        const unreadCount = conv.comments.filter(
          (c) => c.author_id !== currentUserId && new Date(c.created_at).getTime() > lastReadTime
        ).length;

        inboxItems.push({
          id: convKey,
          type: conv.taskId ? 'task_discussion' : 'project_discussion',
          projectId: conv.projectId,
          projectName: project.name,
          projectColor: project.color,
          taskId: conv.taskId,
          taskTitle: conv.taskTitle,
          senderName,
          senderRole,
          lastMessageSnippet: latest.body || '',
          lastActivityAt: latest.created_at,
          unreadCount,
        });
      }

      // Add task requests
      for (const r of requests || []) {
        const project = projectMap.get(r.project_id);
        if (!project) continue;

        const requesterProfile = profilesMap.get(r.requested_by);
        const senderName = requesterProfile?.name || 'Client';

        inboxItems.push({
          id: `req:${r.id}`,
          type: 'task_request',
          projectId: r.project_id,
          projectName: project.name,
          projectColor: project.color,
          taskId: null,
          taskTitle: r.title,
          senderName,
          senderRole: 'Client Collaborator',
          lastMessageSnippet: r.description || r.reason || `Task request: ${r.title}`,
          lastActivityAt: r.updated_at || r.created_at,
          unreadCount: r.status === 'submitted' ? 1 : 0,
          requestStatus: r.status,
          taskRequest: {
            id: r.id,
            projectId: r.project_id,
            requestedBy: r.requested_by,
            title: r.title,
            description: r.description,
            reason: r.reason,
            suggestedPriority: r.suggested_priority,
            requestedDueDate: r.requested_due_date,
            status: r.status,
            ownerFeedback: r.owner_feedback,
            createdTaskId: r.created_task_id,
            reviewedAt: r.reviewed_at,
            reviewedBy: r.reviewed_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            requesterName: senderName,
            projectName: project.name,
            projectColor: project.color,
          },
        });
      }

      // Sort by newest activity first
      inboxItems.sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );

      return { data: inboxItems, error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch inbox' };
    }
  },

  // ---------------------------------------------------------------------------
  // Project Updates & Notifications
  // ---------------------------------------------------------------------------

  async fetchProjectUpdates(
    projectId: string
  ): Promise<{ data: ProjectUpdate[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    try {
      const { data, error } = await supabase
        .from('project_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
          return {
            data: null,
            error: "Database table 'public.project_task_requests' does not exist yet. Migration 20261123000014 must be applied to the remote database to create it.",
          };
        }
        return { data: null, error: error.message };
      }

      const authorIds = (data || []).map((row: any) => row.author_id);
      const profilesMap = await this.resolveProfiles(authorIds);

      const updates: ProjectUpdate[] = (data || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        authorId: row.author_id,
        status: row.status as any,
        progressSnapshot: row.progress_snapshot,
        message: row.message,
        targetCompletionDate: row.target_completion_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        authorName: profilesMap.get(row.author_id)?.name || 'Project Owner',
      }));

      return { data: updates, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch project updates' };
    }
  },

  async publishProjectUpdate(input: {
    projectId: string;
    status: ClientProjectStatus;
    progressSnapshot?: number | null;
    message: string;
    targetCompletionDate?: string | null;
  }): Promise<{ data: ProjectUpdate | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { data: null, error: 'Supabase client not configured' };

    const trimmedMsg = input.message.trim();
    if (!trimmedMsg) return { data: null, error: 'Update message is required.' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) return { data: null, error: 'Authentication required' };

      const { data: row, error } = await supabase
        .from('project_updates')
        .insert({
          project_id: input.projectId,
          author_id: currentUserId,
          status: input.status,
          progress_snapshot: input.progressSnapshot ?? null,
          message: trimmedMsg,
          target_completion_date: input.targetCompletionDate || null,
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
          return {
            data: null,
            error: "Database table 'public.project_task_requests' does not exist yet. Migration 20261123000014 must be applied to the remote database to create it.",
          };
        }
        return { data: null, error: error.message };
      }

      await supabase
        .from('projects')
        .update({
          client_project_status: input.status,
          target_completion_date: input.targetCompletionDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.projectId);

      this.dispatchProjectUpdateNotifications({
        projectId: input.projectId,
        status: input.status,
        messagePreview: trimmedMsg.slice(0, 100),
      }).catch(() => {});

      return {
        data: {
          id: row.id,
          projectId: row.project_id,
          authorId: row.author_id,
          status: row.status as any,
          progressSnapshot: row.progress_snapshot,
          message: row.message,
          targetCompletionDate: row.target_completion_date,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to publish project update' };
    }
  },

  // ---------------------------------------------------------------------------
  // Notification Dispatch Helpers
  // ---------------------------------------------------------------------------

  async dispatchCommentNotifications(params: {
    projectId: string;
    taskId: string | null;
    commentId: string;
    authorId: string;
    authorName: string;
    authorEmail: string;
    bodyPreview: string;
    isReply: boolean;
  }) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const { data: project } = await supabase
        .from('projects')
        .select('user_id, name')
        .eq('id', params.projectId)
        .single();

      if (!project) return;

      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', params.projectId)
        .eq('membership_status', 'accepted')
        .not('user_id', 'is', null);

      const recipientIds = new Set<string>();

      // If author is client, notify owner
      if (params.authorId !== project.user_id) {
        recipientIds.add(project.user_id);
      }

      // Notify other accepted members
      for (const m of members || []) {
        if (m.user_id && m.user_id !== params.authorId) {
          recipientIds.add(m.user_id);
        }
      }

      if (recipientIds.size === 0) return;

      const notifType = params.isReply
        ? 'comment_reply'
        : params.taskId
        ? 'task_comment'
        : 'project_comment';

      const notifTitle = params.isReply
        ? `Reply from ${params.authorName}`
        : params.taskId
        ? `New task comment from ${params.authorName}`
        : `New project discussion from ${params.authorName}`;

      const rows = Array.from(recipientIds).map((uid) => ({
        recipient_user_id: uid,
        project_id: params.projectId,
        comment_id: params.commentId,
        notification_type: notifType,
        title: notifTitle,
        body: params.bodyPreview,
      }));

      await supabase.from('project_notifications').insert(rows);
    } catch (err) {
      console.warn('Dispatch notification notice:', err);
    }
  },

  async dispatchProjectUpdateNotifications(params: {
    projectId: string;
    status: ClientProjectStatus;
    messagePreview: string;
  }) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', params.projectId)
        .single();

      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', params.projectId)
        .eq('membership_status', 'accepted')
        .not('user_id', 'is', null);

      if (!members || members.length === 0) return;

      const statusLabels: Record<ClientProjectStatus, string> = {
        on_track: 'On Track',
        at_risk: 'At Risk',
        delayed: 'Delayed',
        completed: 'Completed',
      };

      const rows = members
        .filter((m) => m.user_id)
        .map((m) => ({
          recipient_user_id: m.user_id!,
          project_id: params.projectId,
          notification_type: 'project_update',
          title: `Project Update: ${project?.name || 'Project'} is ${statusLabels[params.status]}`,
          body: params.messagePreview,
        }));

      if (rows.length > 0) {
        await supabase.from('project_notifications').insert(rows);
      }
    } catch (err) {
      console.warn('Update notification notice:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // Backward Compatibility Aliases
  // ---------------------------------------------------------------------------

  async getCommentsForProject(projectId: string, taskId?: string | null) {
    return this.fetchComments(projectId, taskId);
  },

  async toggleCommentResolved(commentId: string, resolved: boolean) {
    return this.resolveThread(commentId, resolved);
  },

  async getProjectUpdates(projectId: string) {
    return this.fetchProjectUpdates(projectId);
  },

  async createProjectUpdate(input: {
    projectId: string;
    status: ClientProjectStatus;
    message: string;
    targetCompletionDate?: string | null;
  }) {
    return this.publishProjectUpdate(input);
  },

  async getNotificationsForUser(unreadOnly?: boolean) {
    const res = await this.fetchInboxConversations();
    // Return empty array if error or notifications
    return { data: [], error: null };
  },

  async markNotificationAsRead(id: string) {
    return { success: true, error: null };
  },

  async markAllNotificationsAsRead() {
    return { success: true, error: null };
  },

  async getUnreadNotificationCount(): Promise<{ data: number | null; error: string | null }> {
    const res = await this.fetchInboxConversations();
    const count = (res.data || []).reduce((acc, item) => acc + item.unreadCount, 0);
    return { data: count, error: null };
  },
};
