export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      conversation_reads: {
        Row: {
          id: string
          user_id: string
          project_id: string
          task_id: string | null
          last_read_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          task_id?: string | null
          last_read_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          task_id?: string | null
          last_read_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_task_requests: {
        Row: {
          id: string
          project_id: string
          requested_by: string
          title: string
          description: string | null
          reason: string | null
          suggested_priority: 'low' | 'medium' | 'high' | 'urgent'
          requested_due_date: string | null
          status: 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn'
          owner_feedback: string | null
          created_task_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          requested_by: string
          title: string
          description?: string | null
          reason?: string | null
          suggested_priority?: 'low' | 'medium' | 'high' | 'urgent'
          requested_due_date?: string | null
          status?: 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn'
          owner_feedback?: string | null
          created_task_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          requested_by?: string
          title?: string
          description?: string | null
          reason?: string | null
          suggested_priority?: 'low' | 'medium' | 'high' | 'urgent'
          requested_due_date?: string | null
          status?: 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn'
          owner_feedback?: string | null
          created_task_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_roles: {
        Row: {
          id: string
          user_id: string
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      active_timers: {
        Row: {
          created_at: string
          segment_started_at: string | null
          state: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          segment_started_at?: string | null
          state: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          segment_started_at?: string | null
          state?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_timers_task_user_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          created_at: string
          google_account_email: string | null
          google_calendar_id: string
          granted_scopes: string[]
          last_error: string | null
          last_sync_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_account_email?: string | null
          google_calendar_id?: string
          granted_scopes?: string[]
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_account_email?: string | null
          google_calendar_id?: string
          granted_scopes?: string[]
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_event_mappings: {
        Row: {
          created_at: string
          google_calendar_id: string
          google_event_id: string
          id: string
          last_synced_at: string
          sync_status: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_calendar_id?: string
          google_event_id: string
          id?: string
          last_synced_at?: string
          sync_status?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_calendar_id?: string
          google_event_id?: string
          id?: string
          last_synced_at?: string
          sync_status?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_event_mappings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_sync_jobs: {
        Row: {
          created_at: string
          google_calendar_id: string
          google_event_id: string | null
          id: string
          last_error: string | null
          max_retries: number
          operation: string
          payload: Json
          retry_count: number
          status: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_calendar_id?: string
          google_event_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number
          operation: string
          payload?: Json
          retry_count?: number
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_calendar_id?: string
          google_event_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number
          operation?: string
          payload?: Json
          retry_count?: number
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token_expires_at: string | null
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_expires_at?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_expires_at?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_format: string
          default_calendar_sync_enabled: boolean
          default_event_duration_minutes: number
          default_reminder_offset_minutes: number
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          notifications_enabled: boolean
          time_format: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_format?: string
          default_calendar_sync_enabled?: boolean
          default_event_duration_minutes?: number
          default_reminder_offset_minutes?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          notifications_enabled?: boolean
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_format?: string
          default_calendar_sync_enabled?: boolean
          default_event_duration_minutes?: number
          default_reminder_offset_minutes?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          notifications_enabled?: boolean
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_name: string | null
          client_allow_comments: boolean
          client_project_status: string
          client_share_enabled: boolean
          client_view_remaining_estimate: boolean
          client_view_task_dates: boolean
          client_view_time_tracking: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          target_completion_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          client_allow_comments?: boolean
          client_project_status?: string
          client_share_enabled?: boolean
          client_view_remaining_estimate?: boolean
          client_view_task_dates?: boolean
          client_view_time_tracking?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          target_completion_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          client_allow_comments?: boolean
          client_project_status?: string
          client_share_enabled?: boolean
          client_view_remaining_estimate?: boolean
          client_view_task_dates?: boolean
          client_view_time_tracking?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          target_completion_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          invited_by: string
          invited_email: string
          membership_status: string
          project_id: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by: string
          invited_email: string
          membership_status?: string
          project_id: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          invited_email?: string
          membership_status?: string
          project_id?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          project_id: string
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          invited_by: string
          invited_email: string
          project_id: string
          revoked_at?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          project_id?: string
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_comment_id: string | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_updates: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          progress_snapshot: number | null
          project_id: string
          status: string
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          progress_snapshot?: number | null
          project_id: string
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          progress_snapshot?: number | null
          project_id?: string
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_notifications: {
        Row: {
          body: string
          comment_id: string | null
          created_at: string
          id: string
          notification_type: string
          project_id: string
          read_at: string | null
          recipient_user_id: string
          title: string
        }
        Insert: {
          body: string
          comment_id?: string | null
          created_at?: string
          id?: string
          notification_type: string
          project_id: string
          read_at?: string | null
          recipient_user_id: string
          title: string
        }
        Update: {
          body?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          notification_type?: string
          project_id?: string
          read_at?: string | null
          recipient_user_id?: string
          title?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_reminders: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          remind_at: string
          sent_at?: string | null
          status?: string
          task_id: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          remind_at?: string
          sent_at?: string | null
          status?: string
          task_id?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_user_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      tasks: {
        Row: {
          calendar_sync_status: string
          client_visible: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          planned_duration_minutes: number | null
          priority: string
          project_id: string | null
          remaining_estimate_minutes: number | null
          reminder_offset_minutes: number | null
          scheduled_date: string | null
          scheduled_start_time: string | null
          sort_order: number
          status: string
          sync_to_google_calendar: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_sync_status?: string
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          planned_duration_minutes?: number | null
          priority?: string
          project_id?: string | null
          remaining_estimate_minutes?: number | null
          reminder_offset_minutes?: number | null
          scheduled_date?: string | null
          scheduled_start_time?: string | null
          sort_order?: number
          status?: string
          sync_to_google_calendar?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_sync_status?: string
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          planned_duration_minutes?: number | null
          priority?: string
          project_id?: string | null
          remaining_estimate_minutes?: number | null
          reminder_offset_minutes?: number | null
          scheduled_date?: string | null
          scheduled_start_time?: string | null
          sort_order?: number
          status?: string
          sync_to_google_calendar?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_user_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_calendar_event_duration_minutes: number
          theme: string
          timezone: string
          updated_at: string
          user_id: string
          week_start_day: string
        }
        Insert: {
          created_at?: string
          default_calendar_event_duration_minutes?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
          week_start_day?: string
        }
        Update: {
          created_at?: string
          default_calendar_event_duration_minutes?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          week_start_day?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          entry_type: string
          id: string
          notes: string | null
          project_id: string | null
          session_date: string
          started_at: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          ended_at?: string | null
          entry_type?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          session_date?: string
          started_at?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          entry_type?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          session_date?: string
          started_at?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_project_user_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "work_sessions_task_user_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rpc_approve_task_request: {
        Args: {
          p_request_id: string
          p_title: string
          p_description?: string
          p_scheduled_date?: string
          p_scheduled_start_time?: string
          p_planned_duration_minutes?: number
          p_priority?: string
          p_client_visible?: boolean
        }
        Returns: {
          success: boolean
          task_id?: string
          error?: string
        }
      }
      cancel_task_reminder: { Args: { p_task_id: string }; Returns: boolean }
      disconnect_google_calendar: { Args: never; Returns: boolean }
      get_calendar_integration_status: { Args: never; Returns: Json }
      queue_calendar_sync_job: {
        Args: {
          p_calendar_id?: string
          p_operation: string
          p_payload?: Json
          p_task_id: string
        }
        Returns: string
      }
      rpc_complete_task_with_timer: {
        Args: { p_task_id: string }
        Returns: Json
      }
      rpc_pause_timer: { Args: never; Returns: Json }
      rpc_resume_timer: { Args: never; Returns: Json }
      rpc_start_timer: { Args: { p_task_id: string }; Returns: Json }
      rpc_stop_timer: { Args: never; Returns: Json }
      rpc_switch_timer: { Args: { p_new_task_id: string }; Returns: Json }
      upsert_task_reminder: {
        Args: { p_remind_at: string; p_task_id: string; p_timezone?: string }
        Returns: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string
          timezone: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "task_reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
