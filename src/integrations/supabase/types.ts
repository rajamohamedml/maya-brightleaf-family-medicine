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
      appointments: {
        Row: {
          created_at: string
          end_at: string
          id: string
          intake_status: Database["public"]["Enums"]["intake_status"]
          manage_token: string
          mode: Database["public"]["Enums"]["visit_mode"]
          patient_id: string
          reason_category: Database["public"]["Enums"]["reason_category"]
          reconfirmed_at: string | null
          source: Database["public"]["Enums"]["appt_source"]
          start_at: string
          status: Database["public"]["Enums"]["appt_status"]
          visit_type_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
          manage_token?: string
          mode?: Database["public"]["Enums"]["visit_mode"]
          patient_id: string
          reason_category: Database["public"]["Enums"]["reason_category"]
          reconfirmed_at?: string | null
          source?: Database["public"]["Enums"]["appt_source"]
          start_at: string
          status?: Database["public"]["Enums"]["appt_status"]
          visit_type_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
          manage_token?: string
          mode?: Database["public"]["Enums"]["visit_mode"]
          patient_id?: string
          reason_category?: Database["public"]["Enums"]["reason_category"]
          reconfirmed_at?: string | null
          source?: Database["public"]["Enums"]["appt_source"]
          start_at?: string
          status?: Database["public"]["Enums"]["appt_status"]
          visit_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_visit_type_id_fkey"
            columns: ["visit_type_id"]
            isOneToOne: false
            referencedRelation: "visit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          actions_count: number
          details: Json
          id: string
          minutes_saved: number
          rule: string
          run_at: string
        }
        Insert: {
          actions_count?: number
          details?: Json
          id?: string
          minutes_saved?: number
          rule: string
          run_at?: string
        }
        Update: {
          actions_count?: number
          details?: Json
          id?: string
          minutes_saved?: number
          rule?: string
          run_at?: string
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          accepted_insurers: string[]
          address: string
          buffer_minutes: number
          clinic_name: string
          demo_now: string | null
          doctor_name: string
          hours: Json
          id: number
          phone: string
          self_pay: Json
          slot_step_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          accepted_insurers?: string[]
          address?: string
          buffer_minutes?: number
          clinic_name?: string
          demo_now?: string | null
          doctor_name?: string
          hours?: Json
          id?: number
          phone?: string
          self_pay?: Json
          slot_step_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          accepted_insurers?: string[]
          address?: string
          buffer_minutes?: number
          clinic_name?: string
          demo_now?: string | null
          doctor_name?: string
          hours?: Json
          id?: number
          phone?: string
          self_pay?: Json
          slot_step_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      intake_forms: {
        Row: {
          appointment_id: string
          data: Json
          id: string
          patient_id: string
          submitted_at: string
        }
        Insert: {
          appointment_id: string
          data?: Json
          id?: string
          patient_id: string
          submitted_at?: string
        }
        Update: {
          appointment_id?: string
          data?: Json
          id?: string
          patient_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          converted_appointment_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_activity_at: string
          last_name: string | null
          nudged_at: string | null
          phone: string | null
          reason_category: Database["public"]["Enums"]["reason_category"] | null
          source: Database["public"]["Enums"]["appt_source"]
          step_reached: string
        }
        Insert: {
          converted_appointment_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_activity_at?: string
          last_name?: string | null
          nudged_at?: string | null
          phone?: string | null
          reason_category?:
            | Database["public"]["Enums"]["reason_category"]
            | null
          source?: Database["public"]["Enums"]["appt_source"]
          step_reached: string
        }
        Update: {
          converted_appointment_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_activity_at?: string
          last_name?: string | null
          nudged_at?: string | null
          phone?: string | null
          reason_category?:
            | Database["public"]["Enums"]["reason_category"]
            | null
          source?: Database["public"]["Enums"]["appt_source"]
          step_reached?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          appointment_id: string | null
          body: string
          channel: Database["public"]["Enums"]["msg_channel"]
          id: string
          lead_id: string | null
          patient_id: string | null
          rule: string | null
          sent_at: string
          subject: string | null
          template: string
          to_address: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          channel: Database["public"]["Enums"]["msg_channel"]
          id?: string
          lead_id?: string | null
          patient_id?: string | null
          rule?: string | null
          sent_at?: string
          subject?: string | null
          template: string
          to_address: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          channel?: Database["public"]["Enums"]["msg_channel"]
          id?: string
          lead_id?: string | null
          patient_id?: string | null
          rule?: string | null
          sent_at?: string
          subject?: string | null
          template?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          dob: string
          email: string
          first_name: string
          id: string
          insurer: string
          is_new: boolean
          last_name: string
          no_show_count: number
          phone: string
        }
        Insert: {
          created_at?: string
          dob: string
          email: string
          first_name: string
          id?: string
          insurer: string
          is_new?: boolean
          last_name: string
          no_show_count?: number
          phone: string
        }
        Update: {
          created_at?: string
          dob?: string
          email?: string
          first_name?: string
          id?: string
          insurer?: string
          is_new?: boolean
          last_name?: string
          no_show_count?: number
          phone?: string
        }
        Relationships: []
      }
      recalls: {
        Row: {
          created_at: string
          due_date: string
          id: string
          last_contacted_at: string | null
          patient_id: string
          status: Database["public"]["Enums"]["recall_status"]
          visit_type_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          last_contacted_at?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["recall_status"]
          visit_type_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          last_contacted_at?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["recall_status"]
          visit_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recalls_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recalls_visit_type_id_fkey"
            columns: ["visit_type_id"]
            isOneToOne: false
            referencedRelation: "visit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          end_at: string
          id: string
          kind: Database["public"]["Enums"]["block_kind"]
          note: string | null
          start_at: string
        }
        Insert: {
          end_at: string
          id?: string
          kind: Database["public"]["Enums"]["block_kind"]
          note?: string | null
          start_at: string
        }
        Update: {
          end_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["block_kind"]
          note?: string | null
          start_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          done_at: string | null
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          patient_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          summary: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          done_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["task_kind"]
          patient_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          summary: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          done_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          patient_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      visit_types: {
        Row: {
          code: string
          established_only: boolean
          id: string
          insurer_only: string | null
          latest_start: string | null
          max_per_day: number | null
          minutes: number
          modes: Database["public"]["Enums"]["visit_mode"][]
          name: string
          new_only: boolean
          sort: number
        }
        Insert: {
          code: string
          established_only?: boolean
          id?: string
          insurer_only?: string | null
          latest_start?: string | null
          max_per_day?: number | null
          minutes: number
          modes: Database["public"]["Enums"]["visit_mode"][]
          name: string
          new_only?: boolean
          sort?: number
        }
        Update: {
          code?: string
          established_only?: boolean
          id?: string
          insurer_only?: string | null
          latest_start?: string | null
          max_per_day?: number | null
          minutes?: number
          modes?: Database["public"]["Enums"]["visit_mode"][]
          name?: string
          new_only?: boolean
          sort?: number
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          earliest_date: string
          id: string
          latest_date: string
          offer_expires_at: string | null
          offered_appointment_id: string | null
          offered_start_at: string | null
          offered_visit_code: string | null
          patient_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
          visit_type_codes: string[]
          window: Database["public"]["Enums"]["waitlist_window"]
        }
        Insert: {
          created_at?: string
          earliest_date: string
          id?: string
          latest_date: string
          offer_expires_at?: string | null
          offered_appointment_id?: string | null
          offered_start_at?: string | null
          offered_visit_code?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          visit_type_codes: string[]
          window?: Database["public"]["Enums"]["waitlist_window"]
        }
        Update: {
          created_at?: string
          earliest_date?: string
          id?: string
          latest_date?: string
          offer_expires_at?: string | null
          offered_appointment_id?: string | null
          offered_start_at?: string | null
          offered_visit_code?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          visit_type_codes?: string[]
          window?: Database["public"]["Enums"]["waitlist_window"]
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      seed_demo: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "staff"
      appt_source: "form" | "chat" | "voice" | "staff" | "waitlist"
      appt_status:
        | "confirmed"
        | "reconfirmed"
        | "arrived"
        | "completed"
        | "cancelled"
        | "released"
        | "no_show"
      block_kind: "lunch" | "blocked" | "telehealth_only" | "sick_hold"
      intake_status: "not_started" | "done"
      msg_channel: "email" | "sms"
      reason_category:
        | "new_patient"
        | "physical"
        | "follow_up"
        | "sick"
        | "telehealth"
        | "other"
      recall_status: "due" | "contacted" | "booked" | "dismissed"
      task_kind: "refill" | "records" | "billing" | "callback"
      task_status: "open" | "done"
      visit_mode: "in_person" | "telehealth"
      waitlist_status: "waiting" | "offered" | "accepted" | "expired"
      waitlist_window: "am" | "pm" | "any"
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
      app_role: ["staff"],
      appt_source: ["form", "chat", "voice", "staff", "waitlist"],
      appt_status: [
        "confirmed",
        "reconfirmed",
        "arrived",
        "completed",
        "cancelled",
        "released",
        "no_show",
      ],
      block_kind: ["lunch", "blocked", "telehealth_only", "sick_hold"],
      intake_status: ["not_started", "done"],
      msg_channel: ["email", "sms"],
      reason_category: [
        "new_patient",
        "physical",
        "follow_up",
        "sick",
        "telehealth",
        "other",
      ],
      recall_status: ["due", "contacted", "booked", "dismissed"],
      task_kind: ["refill", "records", "billing", "callback"],
      task_status: ["open", "done"],
      visit_mode: ["in_person", "telehealth"],
      waitlist_status: ["waiting", "offered", "accepted", "expired"],
      waitlist_window: ["am", "pm", "any"],
    },
  },
} as const
