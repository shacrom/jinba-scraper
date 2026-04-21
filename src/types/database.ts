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
      generations: {
        Row: {
          chassis_code: string | null
          created_at: string
          id: number
          model_id: number
          name_en: string
          name_es: string
          slug: string
          year_end: number | null
          year_start: number
        }
        Insert: {
          chassis_code?: string | null
          created_at?: string
          id?: never
          model_id: number
          name_en: string
          name_es: string
          slug: string
          year_end?: number | null
          year_start: number
        }
        Update: {
          chassis_code?: string | null
          created_at?: string
          id?: never
          model_id?: number
          name_en?: string
          name_es?: string
          slug?: string
          year_end?: number | null
          year_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "generations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          checksum: string | null
          created_at: string
          height: number | null
          id: number
          listing_id: number
          position: number
          privacy_processed_at: string | null
          source_url: string
          storage_path: string | null
          width: number | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: never
          listing_id: number
          position: number
          privacy_processed_at?: string | null
          source_url: string
          storage_path?: string | null
          width?: number | null
        }
        Update: {
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: never
          listing_id?: number
          position?: number
          privacy_processed_at?: string | null
          source_url?: string
          storage_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_snapshots: {
        Row: {
          captured_at: string
          changed_fields: Json
          id: number
          listing_id: number
          price: number
          status: string
        }
        Insert: {
          captured_at?: string
          changed_fields?: Json
          id?: never
          listing_id: number
          price: number
          status: string
        }
        Update: {
          captured_at?: string
          changed_fields?: Json
          id?: never
          listing_id?: number
          price?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_snapshots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_snapshots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          currency: string
          external_id: string
          first_seen_at: string
          generation_id: number
          id: number
          km: number | null
          last_seen_at: string
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          make_id: number
          model_id: number
          price: number
          raw_html_ref: string | null
          seller_hash: string
          source_id: number
          status: string
          trim_id: number | null
          updated_at: string
          url: string
          year: number
        }
        Insert: {
          created_at?: string
          currency: string
          external_id: string
          first_seen_at?: string
          generation_id: number
          id?: never
          km?: number | null
          last_seen_at?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          make_id: number
          model_id: number
          price: number
          raw_html_ref?: string | null
          seller_hash: string
          source_id: number
          status?: string
          trim_id?: number | null
          updated_at?: string
          url: string
          year: number
        }
        Update: {
          created_at?: string
          currency?: string
          external_id?: string
          first_seen_at?: string
          generation_id?: number
          id?: never
          km?: number | null
          last_seen_at?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          make_id?: number
          model_id?: number
          price?: number
          raw_html_ref?: string | null
          seller_hash?: string
          source_id?: number
          status?: string
          trim_id?: number | null
          updated_at?: string
          url?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "makes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_trim_id_fkey"
            columns: ["trim_id"]
            isOneToOne: false
            referencedRelation: "trims"
            referencedColumns: ["id"]
          },
        ]
      }
      makes: {
        Row: {
          created_at: string
          id: number
          name_en: string
          name_es: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          name_en: string
          name_es: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          name_en?: string
          name_es?: string
          slug?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string
          id: number
          make_id: number
          name_en: string
          name_es: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          make_id: number
          name_en: string
          name_es: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          make_id?: number
          name_en?: string
          name_es?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "makes"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_errors: {
        Row: {
          error_type: string
          id: number
          message: string
          occurred_at: string
          run_id: number
          url: string | null
        }
        Insert: {
          error_type: string
          id?: never
          message: string
          occurred_at?: string
          run_id: number
          url?: string | null
        }
        Update: {
          error_type?: string
          id?: never
          message?: string
          occurred_at?: string
          run_id?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_runs: {
        Row: {
          duration_ms: number | null
          finished_at: string | null
          id: number
          items_errored: number
          items_found: number
          items_new: number
          items_updated: number
          source_id: number
          started_at: string
        }
        Insert: {
          duration_ms?: number | null
          finished_at?: string | null
          id?: never
          items_errored?: number
          items_found?: number
          items_new?: number
          items_updated?: number
          source_id: number
          started_at?: string
        }
        Update: {
          duration_ms?: number | null
          finished_at?: string | null
          id?: never
          items_errored?: number
          items_found?: number
          items_new?: number
          items_updated?: number
          source_id?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrape_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          base_url: string
          config: Json
          created_at: string
          display_name: string
          enabled: boolean
          fetch_strategy: string
          id: number
          last_run_at: string | null
          rate_limit_ms: number
          slug: string
        }
        Insert: {
          base_url: string
          config?: Json
          created_at?: string
          display_name: string
          enabled?: boolean
          fetch_strategy: string
          id?: never
          last_run_at?: string | null
          rate_limit_ms?: number
          slug: string
        }
        Update: {
          base_url?: string
          config?: Json
          created_at?: string
          display_name?: string
          enabled?: boolean
          fetch_strategy?: string
          id?: never
          last_run_at?: string | null
          rate_limit_ms?: number
          slug?: string
        }
        Relationships: []
      }
      takedowns: {
        Row: {
          anuncio_hash: string
          id: number
          notes: string | null
          reason: string
          requested_at: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          anuncio_hash: string
          id?: never
          notes?: string | null
          reason: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          anuncio_hash?: string
          id?: never
          notes?: string | null
          reason?: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      trims: {
        Row: {
          created_at: string
          engine_code: string | null
          generation_id: number
          id: number
          name_en: string
          name_es: string
          power_hp: number | null
          slug: string
        }
        Insert: {
          created_at?: string
          engine_code?: string | null
          generation_id: number
          id?: never
          name_en: string
          name_es: string
          power_hp?: number | null
          slug: string
        }
        Update: {
          created_at?: string
          engine_code?: string | null
          generation_id?: number
          id?: never
          name_en?: string
          name_es?: string
          power_hp?: number | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "trims_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      listings_public: {
        Row: {
          created_at: string | null
          currency: string | null
          external_id: string | null
          first_seen_at: string | null
          generation_id: number | null
          id: number | null
          km: number | null
          last_seen_at: string | null
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          make_id: number | null
          model_id: number | null
          price: number | null
          source_id: number | null
          status: string | null
          trim_id: number | null
          updated_at: string | null
          url: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          first_seen_at?: string | null
          generation_id?: number | null
          id?: number | null
          km?: number | null
          last_seen_at?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          make_id?: number | null
          model_id?: number | null
          price?: number | null
          source_id?: number | null
          status?: string | null
          trim_id?: number | null
          updated_at?: string | null
          url?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          first_seen_at?: string | null
          generation_id?: number | null
          id?: number | null
          km?: number | null
          last_seen_at?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          make_id?: number | null
          model_id?: number | null
          price?: number | null
          source_id?: number | null
          status?: string | null
          trim_id?: number | null
          updated_at?: string | null
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "makes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_trim_id_fkey"
            columns: ["trim_id"]
            isOneToOne: false
            referencedRelation: "trims"
            referencedColumns: ["id"]
          },
        ]
      }
      price_aggregates_daily: {
        Row: {
          count: number | null
          currency: string | null
          date: string | null
          generation_id: number | null
          make_id: number | null
          mean: number | null
          median: number | null
          model_id: number | null
          p25: number | null
          p75: number | null
          year_bucket: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "makes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      sources_public: {
        Row: {
          base_url: string | null
          display_name: string | null
          enabled: boolean | null
          id: number | null
          slug: string | null
        }
        Insert: {
          base_url?: string | null
          display_name?: string | null
          enabled?: boolean | null
          id?: number | null
          slug?: string | null
        }
        Update: {
          base_url?: string | null
          display_name?: string | null
          enabled?: boolean | null
          id?: number | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_price_aggregates_daily: { Args: never; Returns: undefined }
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
    Enums: {},
  },
} as const
