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
      audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cells: {
        Row: {
          capacity_override: number | null
          child_index: number | null
          col_index: number | null
          computed_height_mm: number
          computed_width_mm: number
          created_at: string
          height_mm: number | null
          id: string
          needs_review: boolean
          parent_id: string | null
          product_id: string | null
          rotation_allowed: boolean
          row_index: number | null
          shelf_id: string
          split_direction:
            | Database["public"]["Enums"]["split_direction_enum"]
            | null
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          capacity_override?: number | null
          child_index?: number | null
          col_index?: number | null
          computed_height_mm: number
          computed_width_mm: number
          created_at?: string
          height_mm?: number | null
          id?: string
          needs_review?: boolean
          parent_id?: string | null
          product_id?: string | null
          rotation_allowed?: boolean
          row_index?: number | null
          shelf_id: string
          split_direction?:
            | Database["public"]["Enums"]["split_direction_enum"]
            | null
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          capacity_override?: number | null
          child_index?: number | null
          col_index?: number | null
          computed_height_mm?: number
          computed_width_mm?: number
          created_at?: string
          height_mm?: number | null
          id?: string
          needs_review?: boolean
          parent_id?: string | null
          product_id?: string | null
          rotation_allowed?: boolean
          row_index?: number | null
          shelf_id?: string
          split_direction?:
            | Database["public"]["Enums"]["split_direction_enum"]
            | null
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cells_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_shelf_id_fkey"
            columns: ["shelf_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_entries: {
        Row: {
          actual_packs: number | null
          id: string
          order_line_id: string
          status: Database["public"]["Enums"]["checklist_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_packs?: number | null
          id?: string
          order_line_id: string
          status?: Database["public"]["Enums"]["checklist_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_packs?: number | null
          id?: string
          order_line_id?: string
          status?: Database["public"]["Enums"]["checklist_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_entries_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          color: string
          created_at: string
          id: string
          is_custom: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_custom?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_custom?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          created_at: string
          deficit_units: number | null
          id: string
          is_boundary: boolean
          is_manual: boolean
          order_id: string
          product_id: string
          product_name: string
          quantity_packs: number
          quantity_units: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deficit_units?: number | null
          id?: string
          is_boundary?: boolean
          is_manual?: boolean
          order_id: string
          product_id: string
          product_name?: string
          quantity_packs: number
          quantity_units: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deficit_units?: number | null
          id?: string
          is_boundary?: boolean
          is_manual?: boolean
          order_id?: string
          product_id?: string
          product_name?: string
          quantity_packs?: number
          quantity_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          finalized_at: string | null
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          count_pieces: boolean
          created_at: string
          diameter_mm: number | null
          height_mm: number | null
          id: string
          length_mm: number | null
          material_id: string
          name: string
          pack_size: number
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          count_pieces?: boolean
          created_at?: string
          diameter_mm?: number | null
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          material_id: string
          name: string
          pack_size: number
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          count_pieces?: boolean
          created_at?: string
          diameter_mm?: number | null
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          material_id?: string
          name?: string
          pack_size?: number
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shelves: {
        Row: {
          cols_count: number
          created_at: string
          id: string
          name: string
          rows_count: number
          updated_at: string
        }
        Insert: {
          cols_count: number
          created_at?: string
          id?: string
          name: string
          rows_count: number
          updated_at?: string
        }
        Update: {
          cols_count?: number
          created_at?: string
          id?: string
          name?: string
          rows_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_entries: {
        Row: {
          cell_id: string
          created_at: string
          id: string
          session_id: string
          user_id: string
          value: number
        }
        Insert: {
          cell_id: string
          created_at?: string
          id?: string
          session_id: string
          user_id: string
          value: number
        }
        Update: {
          cell_id?: string
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id: string
          is_active?: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      checklist_status: "pending" | "done" | "unavailable"
      product_type: "unit" | "round" | "bulk"
      session_status:
        | "sweeping"
        | "ordering"
        | "fulfilling"
        | "completed"
        | "abandoned"
      split_direction_enum: "H" | "V"
      user_role: "admin" | "employee"
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
      checklist_status: ["pending", "done", "unavailable"],
      product_type: ["unit", "round", "bulk"],
      session_status: [
        "sweeping",
        "ordering",
        "fulfilling",
        "completed",
        "abandoned",
      ],
      split_direction_enum: ["H", "V"],
      user_role: ["admin", "employee"],
    },
  },
} as const
