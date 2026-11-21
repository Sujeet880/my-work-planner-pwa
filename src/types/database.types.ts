export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string;
          date_format: string;
          time_format: string;
          default_event_duration_minutes: number;
          notifications_enabled: boolean;
          default_calendar_sync_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          date_format?: string;
          time_format?: string;
          default_event_duration_minutes?: number;
          notifications_enabled?: boolean;
          default_calendar_sync_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          date_format?: string;
          time_format?: string;
          default_event_duration_minutes?: number;
          notifications_enabled?: boolean;
          default_calendar_sync_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          theme: string;
          week_start_day: 'monday' | 'sunday';
          timezone: string;
          default_calendar_event_duration_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: string;
          week_start_day?: 'monday' | 'sunday';
          timezone?: string;
          default_calendar_event_duration_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          theme?: string;
          week_start_day?: 'monday' | 'sunday';
          timezone?: string;
          default_calendar_event_duration_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          client_name: string | null;
          description: string | null;
          color: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          client_name?: string | null;
          description?: string | null;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          client_name?: string | null;
          description?: string | null;
          color?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          priority: 'high' | 'medium' | 'low';
          status: 'todo' | 'in_progress' | 'completed';
          scheduled_date: string | null;
          scheduled_start_time: string | null;
          planned_duration_minutes: number | null;
          reminder_offset_minutes: number | null;
          sync_to_google_calendar: boolean;
          calendar_sync_status: 'not_synced' | 'synced' | 'pending' | 'failed';
          completed_at: string | null;
          is_archived: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          priority?: 'high' | 'medium' | 'low';
          status?: 'todo' | 'in_progress' | 'completed';
          scheduled_date?: string | null;
          scheduled_start_time?: string | null;
          planned_duration_minutes?: number | null;
          reminder_offset_minutes?: number | null;
          sync_to_google_calendar?: boolean;
          calendar_sync_status?: 'not_synced' | 'synced' | 'pending' | 'failed';
          completed_at?: string | null;
          is_archived?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          priority?: 'high' | 'medium' | 'low';
          status?: 'todo' | 'in_progress' | 'completed';
          scheduled_date?: string | null;
          scheduled_start_time?: string | null;
          planned_duration_minutes?: number | null;
          reminder_offset_minutes?: number | null;
          sync_to_google_calendar?: boolean;
          calendar_sync_status?: 'not_synced' | 'synced' | 'pending' | 'failed';
          completed_at?: string | null;
          is_archived?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      work_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          project_id: string | null;
          entry_type: 'automatic' | 'manual' | 'timer';
          session_date: string;
          started_at: string | null;
          ended_at: string | null;
          duration_seconds: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          project_id?: string | null;
          entry_type?: 'automatic' | 'manual' | 'timer';
          session_date?: string;
          started_at?: string | null;
          ended_at?: string | null;
          duration_seconds: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          project_id?: string | null;
          entry_type?: 'automatic' | 'manual' | 'timer';
          session_date?: string;
          started_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_sessions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_sessions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      active_timers: {
        Row: {
          user_id: string;
          task_id: string;
          state: 'running' | 'paused';
          segment_started_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          task_id: string;
          state: 'running' | 'paused';
          segment_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          task_id?: string;
          state?: 'running' | 'paused';
          segment_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'active_timers_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      rpc_start_timer: {
        Args: {
          p_task_id: string;
        };
        Returns: Record<string, unknown>;
      };
      rpc_pause_timer: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      rpc_resume_timer: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      rpc_stop_timer: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      rpc_switch_timer: {
        Args: {
          p_new_task_id: string;
        };
        Returns: Record<string, unknown>;
      };
      rpc_complete_task_with_timer: {
        Args: {
          p_task_id: string;
        };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
