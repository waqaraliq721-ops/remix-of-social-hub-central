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
      analytics_snapshots: {
        Row: {
          created_at: string
          engagement: number
          followers: number
          id: string
          impressions: number
          platform: Database["public"]["Enums"]["social_platform"]
          snapshot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagement?: number
          followers?: number
          id?: string
          impressions?: number
          platform: Database["public"]["Enums"]["social_platform"]
          snapshot_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagement?: number
          followers?: number
          id?: string
          impressions?: number
          platform?: Database["public"]["Enums"]["social_platform"]
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      export_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
          watermarked: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          user_id: string
          watermarked?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          watermarked?: boolean
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          read: boolean
          received_at: string
          sender_handle: string
          sender_name: string | null
          user_id: string
        }
        Insert: {
          body: string
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          read?: boolean
          received_at?: string
          sender_handle: string
          sender_name?: string | null
          user_id: string
        }
        Update: {
          body?: string
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          read?: boolean
          received_at?: string
          sender_handle?: string
          sender_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_targets: {
        Row: {
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          post_id: string
          status: Database["public"]["Enums"]["target_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          post_id: string
          status?: Database["public"]["Enums"]["target_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          post_id?: string
          status?: Database["public"]["Enums"]["target_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string
          created_at: string
          id: string
          media_urls: string[]
          platforms: Database["public"]["Enums"]["social_platform"][]
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string
          created_at?: string
          id?: string
          media_urls?: string[]
          platforms?: Database["public"]["Enums"]["social_platform"][]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          id?: string
          media_urls?: string[]
          platforms?: Database["public"]["Enums"]["social_platform"][]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          connected: boolean
          created_at: string
          display_name: string | null
          followers: number
          handle: string
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          connected?: boolean
          created_at?: string
          display_name?: string | null
          followers?: number
          handle: string
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          connected?: boolean
          created_at?: string
          display_name?: string | null
          followers?: number
          handle?: string
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          email: string | null
          notified_tier: Database["public"]["Enums"]["app_tier"] | null
          tier: Database["public"]["Enums"]["app_tier"]
          tier_changed_at: string
          updated_at: string
          user_id: string
          welcome_email_sent: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          notified_tier?: Database["public"]["Enums"]["app_tier"] | null
          tier?: Database["public"]["Enums"]["app_tier"]
          tier_changed_at?: string
          updated_at?: string
          user_id: string
          welcome_email_sent?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          notified_tier?: Database["public"]["Enums"]["app_tier"] | null
          tier?: Database["public"]["Enums"]["app_tier"]
          tier_changed_at?: string
          updated_at?: string
          user_id?: string
          welcome_email_sent?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_quota: { Args: { _user_id: string }; Returns: Json }
    }
    Enums: {
      app_tier: "free" | "basic" | "ultimate"
      post_status: "draft" | "scheduled" | "published" | "failed"
      social_platform:
        | "facebook"
        | "instagram"
        | "tiktok"
        | "youtube"
        | "twitter"
      target_status: "pending" | "publishing" | "published" | "failed"
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
    Enums: {
      app_tier: ["free", "basic", "ultimate"],
      post_status: ["draft", "scheduled", "published", "failed"],
      social_platform: [
        "facebook",
        "instagram",
        "tiktok",
        "youtube",
        "twitter",
      ],
      target_status: ["pending", "publishing", "published", "failed"],
    },
  },
} as const
