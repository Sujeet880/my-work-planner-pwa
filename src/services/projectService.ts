import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { Project } from '../types/models';
import type { Database } from '../types/database.types';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

/**
 * Maps a database project row into the application domain model.
 */
export function mapProjectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    isArchived: row.is_archived,
    targetCompletionDate: row.target_completion_date,
    clientShareEnabled: row.client_share_enabled ?? false,
    clientViewTimeTracking: row.client_view_time_tracking ?? false,
    clientViewRemainingEstimate: row.client_view_remaining_estimate ?? false,
    clientViewTaskDates: row.client_view_task_dates ?? true,
    clientAllowComments: row.client_allow_comments ?? true,
    clientProjectStatus: (row.client_project_status as any) ?? 'on_track',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SaveProjectInput {
  id?: string;
  name: string;
  description?: string;
  color: string;
  clientName?: string;
  targetCompletionDate?: string | null;
  clientShareEnabled?: boolean;
  clientViewTimeTracking?: boolean;
  clientViewRemainingEstimate?: boolean;
  clientViewTaskDates?: boolean;
  clientAllowComments?: boolean;
  clientProjectStatus?: 'on_track' | 'at_risk' | 'delayed' | 'completed';
}

export const projectService = {
  /**
   * Fetches all projects belonging to the authenticated user.
   */
  async fetchProjects(userId: string): Promise<{ data: Project[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: (data ?? []).map(mapProjectFromRow),
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch projects',
      };
    }
  },

  /**
   * Creates a new project in Supabase for the authenticated user.
   */
  async createProject(
    userId: string,
    input: SaveProjectInput
  ): Promise<{ data: Project | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { data: null, error: 'Project name is required' };
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: trimmedName,
          client_name: input.clientName?.trim() || null,
          description: input.description?.trim() || null,
          color: input.color || '#2F65F6',
          is_archived: false,
          target_completion_date: input.targetCompletionDate || null,
          client_share_enabled: input.clientShareEnabled ?? false,
          client_view_time_tracking: input.clientViewTimeTracking ?? false,
          client_view_remaining_estimate: input.clientViewRemainingEstimate ?? false,
          client_view_task_dates: input.clientViewTaskDates ?? true,
          client_allow_comments: input.clientAllowComments ?? true,
          client_project_status: input.clientProjectStatus || 'on_track',
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: data ? mapProjectFromRow(data) : null,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to create project',
      };
    }
  },

  /**
   * Updates an existing project belonging to the authenticated user.
   */
  async updateProject(
    userId: string,
    projectId: string,
    input: SaveProjectInput
  ): Promise<{ data: Project | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { data: null, error: 'Project name is required' };
    }

    try {
      const updateData: Record<string, any> = {
        name: trimmedName,
        client_name: input.clientName?.trim() || null,
        description: input.description?.trim() || null,
        color: input.color,
        updated_at: new Date().toISOString(),
      };

      if (input.targetCompletionDate !== undefined) {
        updateData.target_completion_date = input.targetCompletionDate || null;
      }
      if (input.clientShareEnabled !== undefined) {
        updateData.client_share_enabled = input.clientShareEnabled;
      }
      if (input.clientViewTimeTracking !== undefined) {
        updateData.client_view_time_tracking = input.clientViewTimeTracking;
      }
      if (input.clientViewRemainingEstimate !== undefined) {
        updateData.client_view_remaining_estimate = input.clientViewRemainingEstimate;
      }
      if (input.clientViewTaskDates !== undefined) {
        updateData.client_view_task_dates = input.clientViewTaskDates;
      }
      if (input.clientAllowComments !== undefined) {
        updateData.client_allow_comments = input.clientAllowComments;
      }
      if (input.clientProjectStatus !== undefined) {
        updateData.client_project_status = input.clientProjectStatus;
      }

      const { data, error } = await supabase
        .from('projects')
        .update(updateData as any)
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: data ? mapProjectFromRow(data) : null,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to update project',
      };
    }
  },

  /**
   * Archives or unarchives a project.
   */
  async toggleArchiveProject(
    userId: string,
    projectId: string,
    isArchived: boolean
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle project archive state',
      };
    }
  },

  /**
   * Deletes a project. Foreign key ON DELETE SET NULL on tasks guarantees
   * that associated tasks have their project_id safely cleared rather than deleted.
   */
  async deleteProject(
    userId: string,
    projectId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete project',
      };
    }
  },
};
