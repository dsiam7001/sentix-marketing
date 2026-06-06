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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_calibration: {
        Row: {
          actual_views: number | null
          created_at: string
          delta_notes: string | null
          id: string
          predicted_score: number | null
          user_id: string
          video_id: string | null
        }
        Insert: {
          actual_views?: number | null
          created_at?: string
          delta_notes?: string | null
          id?: string
          predicted_score?: number | null
          user_id: string
          video_id?: string | null
        }
        Update: {
          actual_views?: number | null
          created_at?: string
          delta_notes?: string | null
          id?: string
          predicted_score?: number | null
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_calibration_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos_published"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_cache: {
        Row: {
          created_at: string
          id: string
          last_used: string
          metadata: Json | null
          query: string
          query_hash: string
          source: string
          url: string
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used?: string
          metadata?: Json | null
          query: string
          query_hash: string
          source: string
          url: string
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used?: string
          metadata?: Json | null
          query?: string
          query_hash?: string
          source?: string
          url?: string
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
      autopilot_settings: {
        Row: {
          auto_approve: boolean
          auto_publish_telegram: boolean
          auto_render: boolean
          created_at: string
          daily_quota: number
          enabled: boolean
          paused_until: string | null
          slot_config: Json
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_approve?: boolean
          auto_publish_telegram?: boolean
          auto_render?: boolean
          created_at?: string
          daily_quota?: number
          enabled?: boolean
          paused_until?: string | null
          slot_config?: Json
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_approve?: boolean
          auto_publish_telegram?: boolean
          auto_render?: boolean
          created_at?: string
          daily_quota?: number
          enabled?: boolean
          paused_until?: string | null
          slot_config?: Json
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      competitor_channels: {
        Row: {
          channel_name: string
          channel_url: string
          created_at: string
          id: string
          last_checked: string | null
          last_digest: Json | null
          platform: string
          user_id: string
        }
        Insert: {
          channel_name: string
          channel_url: string
          created_at?: string
          id?: string
          last_checked?: string | null
          last_digest?: Json | null
          platform?: string
          user_id: string
        }
        Update: {
          channel_name?: string
          channel_url?: string
          created_at?: string
          id?: string
          last_checked?: string | null
          last_digest?: Json | null
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      content_ideas: {
        Row: {
          created_at: string
          deleted_at: string | null
          for_date: string
          id: string
          pain_point: string | null
          rationale: string | null
          selected_variant_index: number | null
          status: string
          theme: string | null
          time_slot: string | null
          topic: string
          user_id: string
          variants: Json
          virality_breakdown: Json | null
          virality_score: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          for_date?: string
          id?: string
          pain_point?: string | null
          rationale?: string | null
          selected_variant_index?: number | null
          status?: string
          theme?: string | null
          time_slot?: string | null
          topic: string
          user_id: string
          variants?: Json
          virality_breakdown?: Json | null
          virality_score?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          for_date?: string
          id?: string
          pain_point?: string | null
          rationale?: string | null
          selected_variant_index?: number | null
          status?: string
          theme?: string | null
          time_slot?: string | null
          topic?: string
          user_id?: string
          variants?: Json
          virality_breakdown?: Json | null
          virality_score?: number | null
        }
        Relationships: []
      }
      daily_pulse: {
        Row: {
          ai_strategy: string | null
          auto_trends: Json | null
          competitor_viral: string | null
          created_at: string
          id: string
          market_event: string | null
          pulse_date: string
          telegram_trends: string | null
          user_id: string
        }
        Insert: {
          ai_strategy?: string | null
          auto_trends?: Json | null
          competitor_viral?: string | null
          created_at?: string
          id?: string
          market_event?: string | null
          pulse_date?: string
          telegram_trends?: string | null
          user_id: string
        }
        Update: {
          ai_strategy?: string | null
          auto_trends?: Json | null
          competitor_viral?: string | null
          created_at?: string
          id?: string
          market_event?: string | null
          pulse_date?: string
          telegram_trends?: string | null
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_runs: {
        Row: {
          completed_at: string | null
          id: string
          mode: string
          started_at: string
          status: string
          steps: Json
          summary: Json | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          mode?: string
          started_at?: string
          status?: string
          steps?: Json
          summary?: Json | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          mode?: string
          started_at?: string
          status?: string
          steps?: Json
          summary?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      dual_ai_runs: {
        Row: {
          content: Json
          created_at: string
          feedback: string | null
          final_status: string | null
          id: string
          idea_id: string | null
          iteration: number
          role: string
          score: number | null
          script_id: string | null
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          feedback?: string | null
          final_status?: string | null
          id?: string
          idea_id?: string | null
          iteration?: number
          role: string
          score?: number | null
          script_id?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          feedback?: string | null
          final_status?: string | null
          id?: string
          idea_id?: string | null
          iteration?: number
          role?: string
          score?: number | null
          script_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dual_ai_runs_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dual_ai_runs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_keys: {
        Row: {
          active: boolean
          cooldown_until: string | null
          created_at: string
          daily_calls: number
          daily_reset_at: string
          failure_count: number
          id: string
          key_value: string
          label: string
          last_429_at: string | null
          last_used: string | null
          total_calls: number
          user_id: string
        }
        Insert: {
          active?: boolean
          cooldown_until?: string | null
          created_at?: string
          daily_calls?: number
          daily_reset_at?: string
          failure_count?: number
          id?: string
          key_value: string
          label: string
          last_429_at?: string | null
          last_used?: string | null
          total_calls?: number
          user_id: string
        }
        Update: {
          active?: boolean
          cooldown_until?: string | null
          created_at?: string
          daily_calls?: number
          daily_reset_at?: string
          failure_count?: number
          id?: string
          key_value?: string
          label?: string
          last_429_at?: string | null
          last_used?: string | null
          total_calls?: number
          user_id?: string
        }
        Relationships: []
      }
      guard_reports: {
        Row: {
          ai_video_score: number | null
          ai_voice_score: number | null
          audio_copyright_score: number | null
          audio_match: Json | null
          created_at: string
          flags: Json
          id: string
          raw: Json | null
          render_job_id: string | null
          script_id: string | null
          transcript_actual: string | null
          transcript_match_pct: number | null
          user_id: string
          verdict: string
        }
        Insert: {
          ai_video_score?: number | null
          ai_voice_score?: number | null
          audio_copyright_score?: number | null
          audio_match?: Json | null
          created_at?: string
          flags?: Json
          id?: string
          raw?: Json | null
          render_job_id?: string | null
          script_id?: string | null
          transcript_actual?: string | null
          transcript_match_pct?: number | null
          user_id: string
          verdict?: string
        }
        Update: {
          ai_video_score?: number | null
          ai_voice_score?: number | null
          audio_copyright_score?: number | null
          audio_match?: Json | null
          created_at?: string
          flags?: Json
          id?: string
          raw?: Json | null
          render_job_id?: string | null
          script_id?: string | null
          transcript_actual?: string | null
          transcript_match_pct?: number | null
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      hooks_library: {
        Row: {
          category: string | null
          created_at: string
          emotion: string | null
          favorite: boolean
          hook_text: string
          id: string
          is_seed: boolean
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          emotion?: string | null
          favorite?: boolean
          hook_text: string
          id?: string
          is_seed?: boolean
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          emotion?: string | null
          favorite?: boolean
          hook_text?: string
          id?: string
          is_seed?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          ref_id: string | null
          slot: string | null
          stage: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          ref_id?: string | null
          slot?: string | null
          stage: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          ref_id?: string | null
          slot?: string | null
          stage?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      render_jobs: {
        Row: {
          audio_url: string | null
          created_at: string
          deleted_at: string | null
          error: string | null
          finished_at: string | null
          github_run_id: string | null
          id: string
          payload: Json | null
          script_id: string
          started_at: string
          status: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          finished_at?: string | null
          github_run_id?: string | null
          id?: string
          payload?: Json | null
          script_id: string
          started_at?: string
          status?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          finished_at?: string | null
          github_run_id?: string | null
          id?: string
          payload?: Json | null
          script_id?: string
          started_at?: string
          status?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          asset_plan: Json | null
          audio_url: string | null
          caption: string | null
          created_at: string
          deleted_at: string | null
          duration_sec: number | null
          effects: Json | null
          final_score: number | null
          full_script: string
          hashtags: string | null
          hook: string | null
          id: string
          idea_id: string | null
          iterations_used: number
          music_mood: string | null
          needs_review_reason: string | null
          on_screen_text: Json | null
          polished: boolean
          render_status: string
          scenes: Json
          srt: string | null
          status: string
          thumbnail_concept: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          virality_breakdown: Json | null
          virality_score: number | null
        }
        Insert: {
          asset_plan?: Json | null
          audio_url?: string | null
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_sec?: number | null
          effects?: Json | null
          final_score?: number | null
          full_script: string
          hashtags?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          iterations_used?: number
          music_mood?: string | null
          needs_review_reason?: string | null
          on_screen_text?: Json | null
          polished?: boolean
          render_status?: string
          scenes?: Json
          srt?: string | null
          status?: string
          thumbnail_concept?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          virality_breakdown?: Json | null
          virality_score?: number | null
        }
        Update: {
          asset_plan?: Json | null
          audio_url?: string | null
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_sec?: number | null
          effects?: Json | null
          final_score?: number | null
          full_script?: string
          hashtags?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          iterations_used?: number
          music_mood?: string | null
          needs_review_reason?: string | null
          on_screen_text?: Json | null
          polished?: boolean
          render_status?: string
          scenes?: Json
          srt?: string | null
          status?: string
          thumbnail_concept?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          virality_breakdown?: Json | null
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      sentix_features: {
        Row: {
          created_at: string
          description: string | null
          feature_name: string
          id: string
          last_promoted_at: string | null
          promote_priority: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feature_name: string
          id?: string
          last_promoted_at?: string | null
          promote_priority?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feature_name?: string
          id?: string
          last_promoted_at?: string | null
          promote_priority?: number
          user_id?: string
        }
        Relationships: []
      }
      style_memory: {
        Row: {
          created_at: string
          id: string
          label: string | null
          sample_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          sample_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          sample_text?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos_published: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          platform: string
          published_at: string
          script_id: string | null
          user_id: string
          video_url: string | null
          views_24h: number | null
          views_48h: number | null
          views_72h: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          platform: string
          published_at?: string
          script_id?: string | null
          user_id: string
          video_url?: string | null
          views_24h?: number | null
          views_48h?: number | null
          views_72h?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          platform?: string
          published_at?: string
          script_id?: string | null
          user_id?: string
          video_url?: string | null
          views_24h?: number | null
          views_48h?: number | null
          views_72h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_published_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_calendar: {
        Row: {
          created_at: string
          day_of_week: number
          description: string | null
          id: string
          slot_type: string
          theme: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          description?: string | null
          id?: string
          slot_type?: string
          theme: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          description?: string | null
          id?: string
          slot_type?: string
          theme?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
