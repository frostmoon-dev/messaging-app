export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          accuracy: number | null
          conversation_id: string
          created_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          resolved_at: string | null
          resolved_by: string | null
          sender_id: string
          seen_at?: string | null
          seen_by?: string | null
          sos_repeats?: number
        }
        Insert: {
          accuracy?: number | null
          conversation_id: string
          created_at?: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          sender_id?: string
        }
        Update: {
          accuracy?: number | null
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bond: {
        Row: {
          conversation_id: string
          level: number
          progress: number
          title: string
          together_since: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          level?: number
          progress?: number
          title?: string
          together_since?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          level?: number
          progress?: number
          title?: string
          together_since?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bond_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
          cleared_at?: string | null
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          conversation_id: string
          created_at: string
          created_by: string
          id: string
          note: string | null
          remind_at: string | null
          remind_minutes: number | null
          reminded_at: string | null
          starts_at: string
          title: string
        }
        Insert: {
          all_day?: boolean
          conversation_id: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          remind_at?: string | null
          remind_minutes?: number | null
          reminded_at?: string | null
          starts_at: string
          title: string
        }
        Update: {
          all_day?: boolean
          conversation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          remind_at?: string | null
          remind_minutes?: number | null
          reminded_at?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          accuracy: number | null
          conversation_id: string
          lat: number
          lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          conversation_id: string
          lat: number
          lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          conversation_id?: string
          lat?: number
          lng?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          caption: string | null
          conversation_id: string
          created_at: string
          created_by: string
          id: string
          image_height: number | null
          image_path: string
          image_width: number | null
          memory_date: string
          title: string
        }
        Insert: {
          caption?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string
          id?: string
          image_height?: number | null
          image_path: string
          image_width?: number | null
          memory_date?: string
          title: string
        }
        Update: {
          caption?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          image_height?: number | null
          image_path?: string
          image_width?: number | null
          memory_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          id: string
          image_height: number | null
          image_url: string | null
          image_width: number | null
          message_type: string
          read_at: string | null
          reply_to: string | null
          sender_id: string
          deleted_at?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          edited_at?: string | null
          style?: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          message_type?: string
          read_at?: string | null
          reply_to?: string | null
          sender_id?: string
          style?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          message_type?: string
          read_at?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          last_seen: string | null
          status_emoji: string | null
          status_text: string | null
          status_updated_at: string | null
          username: string
          chat_open_until?: string | null
          notification_preview?: boolean
          notify_reactions?: boolean
          quiet_start?: number | null
          quiet_end?: number | null
          time_zone?: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          last_seen?: string | null
          status_emoji?: string | null
          status_text?: string | null
          status_updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_seen?: string | null
          status_emoji?: string | null
          status_text?: string | null
          status_updated_at?: string | null
          username?: string
          notification_preview?: boolean
          notify_reactions?: boolean
          quiet_start?: number | null
          quiet_end?: number | null
          time_zone?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_hides: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          conversation_id: string
          emoji: string | null
          message_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          emoji?: string | null
          message_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          emoji?: string | null
          message_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_stars: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_stars_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      stickers: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          id: string
          image_height: number | null
          image_path: string
          image_width: number | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by?: string
          id?: string
          image_height?: number | null
          image_path: string
          image_width?: number | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          image_height?: number | null
          image_path?: string
          image_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stickers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stickers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_conversation_folder: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_access_realtime_topic: { Args: { topic: string }; Returns: boolean }
      conversation_stats: {
        Args: { conv: string }
        Returns: {
          favorite_emoji: string
          first_message_at: string
          image_count: number
          message_count: number
        }[]
      }
      delete_push_subscription: {
        Args: { sub_endpoint: string }
        Returns: undefined
      }
      is_conversation_member: { Args: { conv: string }; Returns: boolean }
      mark_messages_delivered: { Args: { conv: string }; Returns: number }
      mark_messages_read: { Args: { conv: string }; Returns: number }
      delete_message: { Args: { msg: string }; Returns: string | null }
      clear_chat: { Args: { conv: string }; Returns: string }
      pin_message: { Args: { msg: string; pinned: boolean }; Returns: string | null }
      heartbeat: { Args: { in_chat: boolean }; Returns: undefined }
      edit_message: { Args: { msg: string; new_content: string }; Returns: string }
      set_reaction: { Args: { msg: string; reaction: string | null }; Returns: undefined }
      resolve_alert: { Args: { alert: string }; Returns: undefined }
      mark_alert_seen: { Args: { alert: string }; Returns: undefined }
      save_push_subscription: {
        Args: { sub_auth: string; sub_endpoint: string; sub_p256dh: string }
        Returns: undefined
      }
      share_location: {
        Args: { accuracy: number; conv: string; lat: number; lng: number }
        Returns: string
      }
      shares_conversation_with: { Args: { other: string }; Returns: boolean }
      stop_sharing_location: { Args: never; Returns: undefined }
      touch_last_seen: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

