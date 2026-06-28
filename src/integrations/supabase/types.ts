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
      activity_factors: {
        Row: {
          created_at: string
          factor: number
          id: string
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          factor: number
          id?: string
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          factor?: number
          id?: string
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      bmr_formulas: {
        Row: {
          age_max: number
          age_min: number
          coef_height: number
          coef_weight: number
          constant: number
          created_at: string
          gender: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          age_max: number
          age_min: number
          coef_height?: number
          coef_weight?: number
          constant?: number
          created_at?: string
          gender: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          age_max?: number
          age_min?: number
          coef_height?: number
          coef_weight?: number
          constant?: number
          created_at?: string
          gender?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          grade_level: number | null
          homeroom_teacher_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          grade_level?: number | null
          homeroom_teacher_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          grade_level?: number | null
          homeroom_teacher_id?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      daily_nutrition_targets: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          date: string
          fat: number
          id: string
          protein: number
          student_id: string
          sugar: number
        }
        Insert: {
          calories: number
          carbs: number
          created_at?: string
          date?: string
          fat: number
          id?: string
          protein: number
          student_id: string
          sugar: number
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          protein?: number
          student_id?: string
          sugar?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_nutrition_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      education_content: {
        Row: {
          author_id: string | null
          body: string
          category: string
          cover_url: string | null
          created_at: string
          id: string
          published: boolean
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          category?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          created_by: string | null
          fat: number
          id: string
          image_url: string | null
          name: string
          price: number
          protein: number
          sugar: number
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          created_by?: string | null
          fat?: number
          id?: string
          image_url?: string | null
          name: string
          price?: number
          protein?: number
          sugar?: number
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          created_by?: string | null
          fat?: number
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          protein?: number
          sugar?: number
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          fat: number
          id: string
          is_active: boolean
          label: string
          protein: number
          sugar: number
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          is_active?: boolean
          label?: string
          protein?: number
          sugar?: number
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          is_active?: boolean
          label?: string
          protein?: number
          sugar?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          food_id: string
          id: string
          order_id: string
          quantity: number
          unit_calories: number
          unit_price: number
        }
        Insert: {
          food_id: string
          id?: string
          order_id: string
          quantity?: number
          unit_calories?: number
          unit_price?: number
        }
        Update: {
          food_id?: string
          id?: string
          order_id?: string
          quantity?: number
          unit_calories?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          student_id: string
          total_calories: number
          total_price: number
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          student_id: string
          total_calories?: number
          total_price?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          student_id?: string
          total_calories?: number
          total_price?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      student_credentials: {
        Row: {
          email: string
          password: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email: string
          password: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: string
          password?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          severity: string
          student_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          severity?: string
          student_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          severity?: string
          student_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          activity_level: string
          birth_date: string | null
          class_id: string | null
          class_name: string
          created_at: string
          full_name: string
          gender: string | null
          height_cm: number | null
          id: string
          nis: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string
          birth_date?: string | null
          class_id?: string | null
          class_name: string
          created_at?: string
          full_name: string
          gender?: string | null
          height_cm?: number | null
          id?: string
          nis: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string
          birth_date?: string | null
          class_id?: string | null
          class_name?: string
          created_at?: string
          full_name?: string
          gender?: string | null
          height_cm?: number | null
          id?: string
          nis?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_class_access: {
        Row: {
          class_id: string
          created_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_class_access_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          consumed_at: string
          created_at: string
          food_id: string
          id: string
          quantity: number
          recorded_by: string | null
          student_id: string
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          food_id: string
          id?: string
          quantity?: number
          recorded_by?: string | null
          student_id: string
        }
        Update: {
          consumed_at?: string
          created_at?: string
          food_id?: string
          id?: string
          quantity?: number
          recorded_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      any_admin_exists: { Args: never; Returns: boolean }
      calc_daily_calories: { Args: { _student_id: string }; Returns: number }
      can_view_student: {
        Args: { _student_id: string; _uid: string }
        Returns: boolean
      }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _detail: Json
          _entity: string
          _entity_id: string
        }
        Returns: undefined
      }
      today_calories: { Args: { _student_id: string }; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "guru"
        | "kantin"
        | "siswa"
        | "wali_kelas"
        | "kepala_sekolah"
      order_status: "pending" | "ready" | "completed" | "cancelled"
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
      app_role: [
        "admin",
        "guru",
        "kantin",
        "siswa",
        "wali_kelas",
        "kepala_sekolah",
      ],
      order_status: ["pending", "ready", "completed", "cancelled"],
    },
  },
} as const
