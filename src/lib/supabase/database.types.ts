// GERADO por scripts/db/gen-types.ts (npm run db:types). Não editar à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          id: number
          created_at: string
          workspace_id: string
          actor_id: string | null
          event: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          id?: never
          created_at?: string
          workspace_id: string
          actor_id?: string | null
          event: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: never
          created_at?: string
          workspace_id?: string
          actor_id?: string | null
          event?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ad_accounts: {
        Row: {
          id: string
          workspace_id: string
          connection_id: string | null
          platform_id: string
          external_id: string
          name: string
          currency: string
          timezone: string
          business_external_id: string | null
          business_name: string | null
          manager_external_id: string | null
          status: string
          is_enabled: boolean
          enabled_at: string | null
          last_synced_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
          project_id: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          connection_id?: string | null
          platform_id: string
          external_id: string
          name: string
          currency?: string
          timezone?: string
          business_external_id?: string | null
          business_name?: string | null
          manager_external_id?: string | null
          status?: string
          is_enabled?: boolean
          enabled_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          project_id?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          connection_id?: string | null
          platform_id?: string
          external_id?: string
          name?: string
          currency?: string
          timezone?: string
          business_external_id?: string | null
          business_name?: string | null
          manager_external_id?: string | null
          status?: string
          is_enabled?: boolean
          enabled_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_project_fk"
            columns: ["workspace_id","project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "ad_accounts_workspace_id_connection_id_fkey"
            columns: ["workspace_id","connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "ad_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          id: string
          workspace_id: string
          ad_account_id: string
          external_id: string
          name: string
          status: string
          objective: string | null
          channel: string | null
          funnel_stage: string | null
          daily_budget: number | null
          started_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          ad_account_id: string
          external_id: string
          name: string
          status?: string
          objective?: string | null
          channel?: string | null
          funnel_stage?: string | null
          daily_budget?: number | null
          started_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          ad_account_id?: string
          external_id?: string
          name?: string
          status?: string
          objective?: string | null
          channel?: string | null
          funnel_stage?: string | null
          daily_budget?: number | null
          started_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      ad_products: {
        Row: {
          id: string
          workspace_id: string
          ad_account_id: string
          external_id: string
          title: string
          brand: string | null
          category: string | null
          image_url: string | null
          price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          ad_account_id: string
          external_id: string
          title: string
          brand?: string | null
          category?: string | null
          image_url?: string | null
          price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          ad_account_id?: string
          external_id?: string
          title?: string
          brand?: string | null
          category?: string | null
          image_url?: string | null
          price?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_products_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      ads: {
        Row: {
          id: string
          workspace_id: string
          ad_account_id: string
          campaign_id: string
          external_id: string
          name: string
          format: string
          status: string
          headline: string | null
          body: string | null
          call_to_action: string | null
          thumbnail_url: string | null
          landing_url: string | null
          created_at: string
          updated_at: string
          post_url: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          ad_account_id: string
          campaign_id: string
          external_id: string
          name: string
          format?: string
          status?: string
          headline?: string | null
          body?: string | null
          call_to_action?: string | null
          thumbnail_url?: string | null
          landing_url?: string | null
          created_at?: string
          updated_at?: string
          post_url?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          ad_account_id?: string
          campaign_id?: string
          external_id?: string
          name?: string
          format?: string
          status?: string
          headline?: string | null
          body?: string | null
          call_to_action?: string | null
          thumbnail_url?: string | null
          landing_url?: string | null
          created_at?: string
          updated_at?: string
          post_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_workspace_id_ad_account_id_campaign_id_fkey"
            columns: ["workspace_id","ad_account_id","campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["workspace_id","ad_account_id","id"]
          },
        ]
      }
      analytics_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          date: string
          channel: string
          sessions: number
          users: number
          new_users: number
          engaged_sessions: number
          key_events: number
          transactions: number
          revenue: number
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          date: string
          channel: string
          sessions?: number
          users?: number
          new_users?: number
          engaged_sessions?: number
          key_events?: number
          transactions?: number
          revenue?: number
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          date?: string
          channel?: string
          sessions?: number
          users?: number
          new_users?: number
          engaged_sessions?: number
          key_events?: number
          transactions?: number
          revenue?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      audit_events: {
        Row: {
          id: number
          created_at: string
          workspace_id: string | null
          actor_id: string | null
          actor_role: string
          action: string
          table_name: string
          record_id: string
          changed_columns: string[] | null
          old_data: Json | null
          new_data: Json | null
          ip: string | null
          user_agent: string | null
          ip_trusted: boolean
        }
        Insert: {
          id?: never
          created_at?: string
          workspace_id?: string | null
          actor_id?: string | null
          actor_role: string
          action: string
          table_name: string
          record_id: string
          changed_columns?: string[] | null
          old_data?: Json | null
          new_data?: Json | null
          ip?: string | null
          user_agent?: string | null
          ip_trusted?: boolean
        }
        Update: {
          id?: never
          created_at?: string
          workspace_id?: string | null
          actor_id?: string | null
          actor_role?: string
          action?: string
          table_name?: string
          record_id?: string
          changed_columns?: string[] | null
          old_data?: Json | null
          new_data?: Json | null
          ip?: string | null
          user_agent?: string | null
          ip_trusted?: boolean
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          id: number
          created_at: string
          user_id: string | null
          email: string | null
          event: string
          method: string | null
          ip: string | null
          user_agent: string | null
          metadata: Json
        }
        Insert: {
          id?: never
          created_at?: string
          user_id?: string | null
          email?: string | null
          event: string
          method?: string | null
          ip?: string | null
          user_agent?: string | null
          metadata?: Json
        }
        Update: {
          id?: never
          created_at?: string
          user_id?: string | null
          email?: string | null
          event?: string
          method?: string | null
          ip?: string | null
          user_agent?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          workspace_id: string
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id: string
          email: string
          legal_name: string | null
          tax_id: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id: string
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id: string
          email: string
          legal_name?: string | null
          tax_id?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id?: string
          email?: string
          legal_name?: string | null
          tax_id?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          id: string
          provider: Database["public"]["Enums"]["billing_provider"]
          type: string
          payload: Json
          received_at: string
          processed_at: string | null
          error: string | null
        }
        Insert: {
          id: string
          provider: Database["public"]["Enums"]["billing_provider"]
          type: string
          payload: Json
          received_at?: string
          processed_at?: string | null
          error?: string | null
        }
        Update: {
          id?: string
          provider?: Database["public"]["Enums"]["billing_provider"]
          type?: string
          payload?: Json
          received_at?: string
          processed_at?: string | null
          error?: string | null
        }
        Relationships: []
      }
      billing_items: {
        Row: {
          id: string
          name: string
          kind: string
          unit_cents: number
          currency: string
          stripe_price_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          kind: string
          unit_cents: number
          currency?: string
          stripe_price_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          kind?: string
          unit_cents?: number
          currency?: string
          stripe_price_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_types: {
        Row: {
          id: string
          name: string
          description: string
          profile: string
          sort: number
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string
          profile: string
          sort?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          profile?: string
          sort?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      checkout_items: {
        Row: {
          id: string
          checkout_session_id: string
          kind: string
          plan_price_id: string | null
          billing_item_id: string | null
          quantity: number
          amount_cents: number
          label: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          checkout_session_id: string
          kind: string
          plan_price_id?: string | null
          billing_item_id?: string | null
          quantity: number
          amount_cents: number
          label: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          checkout_session_id?: string
          kind?: string
          plan_price_id?: string | null
          billing_item_id?: string | null
          quantity?: number
          amount_cents?: number
          label?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_items_billing_item_id_fkey"
            columns: ["billing_item_id"]
            isOneToOne: false
            referencedRelation: "billing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_items_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_items_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          id: string
          status: Database["public"]["Enums"]["checkout_status"]
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_session_id: string | null
          user_id: string | null
          workspace_id: string | null
          email: string
          full_name: string
          company_name: string
          phone: string | null
          tax_id: string | null
          plan_id: string | null
          interval: Database["public"]["Enums"]["billing_interval"]
          accounts_quantity: number
          business_type_id: string | null
          selection: Json
          quote: Json
          amount_due_now_cents: number
          recurring_cents: number
          currency: string
          expires_at: string
          completed_at: string | null
          created_at: string
          updated_at: string
          product: Database["public"]["Enums"]["product_line"]
        }
        Insert: {
          id?: string
          status?: Database["public"]["Enums"]["checkout_status"]
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_session_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
          email: string
          full_name: string
          company_name: string
          phone?: string | null
          tax_id?: string | null
          plan_id?: string | null
          interval: Database["public"]["Enums"]["billing_interval"]
          accounts_quantity?: number
          business_type_id?: string | null
          selection: Json
          quote: Json
          amount_due_now_cents: number
          recurring_cents?: number
          currency?: string
          expires_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Update: {
          id?: string
          status?: Database["public"]["Enums"]["checkout_status"]
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_session_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
          email?: string
          full_name?: string
          company_name?: string
          phone?: string | null
          tax_id?: string | null
          plan_id?: string | null
          interval?: Database["public"]["Enums"]["billing_interval"]
          accounts_quantity?: number
          business_type_id?: string | null
          selection?: Json
          quote?: Json
          amount_due_now_cents?: number
          recurring_cents?: number
          currency?: string
          expires_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_business_type_id_fkey"
            columns: ["business_type_id"]
            isOneToOne: false
            referencedRelation: "business_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_secrets: {
        Row: {
          connection_id: string
          access_token_secret_id: string
          refresh_token_secret_id: string | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          access_token_secret_id: string
          refresh_token_secret_id?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          access_token_secret_id?: string
          refresh_token_secret_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          id: string
          workspace_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status: Database["public"]["Enums"]["connection_status"]
          external_user_id: string
          external_user_name: string | null
          external_user_email: string | null
          scopes: string[]
          is_mock: boolean
          connected_by: string | null
          connected_at: string
          token_expires_at: string | null
          last_synced_at: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["connection_status"]
          external_user_id: string
          external_user_name?: string | null
          external_user_email?: string | null
          scopes?: string[]
          is_mock?: boolean
          connected_by?: string | null
          connected_at?: string
          token_expires_at?: string | null
          last_synced_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["connection_status"]
          external_user_id?: string
          external_user_name?: string | null
          external_user_email?: string | null
          scopes?: string[]
          is_mock?: boolean
          connected_by?: string | null
          connected_at?: string
          token_expires_at?: string | null
          last_synced_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          id: number
          user_id: string
          delta: number
          reason: string
          store: string | null
          product_id: string | null
          store_transaction_id: string | null
          store_event_id: string | null
          created_at: string
        }
        Insert: {
          id?: never
          user_id: string
          delta: number
          reason: string
          store?: string | null
          product_id?: string | null
          store_transaction_id?: string | null
          store_event_id?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          user_id?: string
          delta?: number
          reason?: string
          store?: string | null
          product_id?: string | null
          store_transaction_id?: string | null
          store_event_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      crm_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          date: string
          stage: string
          stage_order: number
          deals: number
          value: number
          won: number
          won_value: number
          lost: number
          leads: number
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          date: string
          stage: string
          stage_order?: number
          deals?: number
          value?: number
          won?: number
          won_value?: number
          lost?: number
          leads?: number
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          date?: string
          stage?: string
          stage_order?: number
          deals?: number
          value?: number
          won?: number
          won_value?: number
          lost?: number
          leads?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_daily_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      dashboard_exports: {
        Row: {
          id: string
          workspace_id: string
          dashboard_id: string | null
          dashboard_name: string
          kind: string
          storage_path: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          dashboard_id?: string | null
          dashboard_name: string
          kind?: string
          storage_path?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          dashboard_id?: string | null
          dashboard_name?: string
          kind?: string
          storage_path?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_exports_workspace_id_dashboard_id_fkey"
            columns: ["workspace_id","dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "dashboard_exports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_page_types: {
        Row: {
          id: string
          name: string
          description: string
          min_plan_id: string
          template_only: boolean
          is_soon: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string
          min_plan_id: string
          template_only?: boolean
          is_soon?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          min_plan_id?: string
          template_only?: boolean
          is_soon?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_page_types_min_plan_id_fkey"
            columns: ["min_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_pages: {
        Row: {
          workspace_id: string
          dashboard_id: string
          page_type_id: string
          position: number
          config: Json
          created_at: string
        }
        Insert: {
          workspace_id: string
          dashboard_id: string
          page_type_id: string
          position: number
          config?: Json
          created_at?: string
        }
        Update: {
          workspace_id?: string
          dashboard_id?: string
          page_type_id?: string
          position?: number
          config?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_pages_page_type_id_fkey"
            columns: ["page_type_id"]
            isOneToOne: false
            referencedRelation: "dashboard_page_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_pages_workspace_id_dashboard_id_fkey"
            columns: ["workspace_id","dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      dashboard_sources: {
        Row: {
          workspace_id: string
          dashboard_id: string
          ad_account_id: string
          created_at: string
        }
        Insert: {
          workspace_id: string
          dashboard_id: string
          ad_account_id: string
          created_at?: string
        }
        Update: {
          workspace_id?: string
          dashboard_id?: string
          ad_account_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_sources_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "dashboard_sources_workspace_id_dashboard_id_fkey"
            columns: ["workspace_id","dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      dashboard_template_business_types: {
        Row: {
          template_id: string
          business_type_id: string
        }
        Insert: {
          template_id: string
          business_type_id: string
        }
        Update: {
          template_id?: string
          business_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_template_business_types_business_type_id_fkey"
            columns: ["business_type_id"]
            isOneToOne: false
            referencedRelation: "business_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_template_business_types_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dashboard_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_template_pages: {
        Row: {
          template_id: string
          page_type_id: string
          position: number
        }
        Insert: {
          template_id: string
          page_type_id: string
          position: number
        }
        Update: {
          template_id?: string
          page_type_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_template_pages_page_type_id_fkey"
            columns: ["page_type_id"]
            isOneToOne: false
            referencedRelation: "dashboard_page_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_template_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dashboard_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_template_platforms: {
        Row: {
          template_id: string
          platform_id: string
        }
        Insert: {
          template_id: string
          platform_id: string
        }
        Update: {
          template_id?: string
          platform_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_template_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_template_platforms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dashboard_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_templates: {
        Row: {
          id: string
          name: string
          description: string
          category: string
          profile: string
          min_plan_id: string
          data_mode: string
          sort: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string
          category: string
          profile: string
          min_plan_id: string
          data_mode?: string
          sort?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          category?: string
          profile?: string
          min_plan_id?: string
          data_mode?: string
          sort?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_templates_min_plan_id_fkey"
            columns: ["min_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_launch_sheets: {
        Row: {
          dashboard_id: string
          workspace_id: string
          link: string
          spreadsheet_id: string
          gid: string
          via: string
          rows: Json
          summary: Json
          read_at: string | null
          last_error: string | null
          last_attempt_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          dashboard_id: string
          workspace_id: string
          link: string
          spreadsheet_id: string
          gid: string
          via: string
          rows?: Json
          summary?: Json
          read_at?: string | null
          last_error?: string | null
          last_attempt_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          dashboard_id?: string
          workspace_id?: string
          link?: string
          spreadsheet_id?: string
          gid?: string
          via?: string
          rows?: Json
          summary?: Json
          read_at?: string | null
          last_error?: string | null
          last_attempt_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboards: {
        Row: {
          id: string
          workspace_id: string
          template_id: string
          name: string
          client_name: string
          goal_cents: number | null
          margin: number | null
          monthly_budget_cents: number | null
          period: string
          custom_days: number
          attribution: string
          currency: string
          brand_color: string | null
          brand_logo_path: string | null
          hide_vyz_brand: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          metric_prefs: Json
          project_id: string | null
          layout: Json
          metric_goals: Json
          cover: Json
        }
        Insert: {
          id?: string
          workspace_id: string
          template_id: string
          name: string
          client_name?: string
          goal_cents?: number | null
          margin?: number | null
          monthly_budget_cents?: number | null
          period?: string
          custom_days?: number
          attribution?: string
          currency?: string
          brand_color?: string | null
          brand_logo_path?: string | null
          hide_vyz_brand?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          metric_prefs?: Json
          project_id?: string | null
          layout?: Json
          metric_goals?: Json
          cover?: Json
        }
        Update: {
          id?: string
          workspace_id?: string
          template_id?: string
          name?: string
          client_name?: string
          goal_cents?: number | null
          margin?: number | null
          monthly_budget_cents?: number | null
          period?: string
          custom_days?: number
          attribution?: string
          currency?: string
          brand_color?: string | null
          brand_logo_path?: string | null
          hide_vyz_brand?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          metric_prefs?: Json
          project_id?: string | null
          layout?: Json
          metric_goals?: Json
          cover?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_project_fk"
            columns: ["workspace_id","project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "dashboards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dashboard_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_account_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          date: string
          spend: number
          impressions: number
          reach: number | null
          clicks: number
          link_clicks: number | null
          landing_page_views: number | null
          add_to_cart: number | null
          initiate_checkout: number | null
          conversions: number
          conversion_value: number
          video_views: number | null
          video_thruplays: number | null
          search_impression_share: number | null
          search_lost_is_budget: number | null
          search_lost_is_rank: number | null
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          date: string
          spend?: number
          impressions?: number
          reach?: number | null
          clicks?: number
          link_clicks?: number | null
          landing_page_views?: number | null
          add_to_cart?: number | null
          initiate_checkout?: number | null
          conversions?: number
          conversion_value?: number
          video_views?: number | null
          video_thruplays?: number | null
          search_impression_share?: number | null
          search_lost_is_budget?: number | null
          search_lost_is_rank?: number | null
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          date?: string
          spend?: number
          impressions?: number
          reach?: number | null
          clicks?: number
          link_clicks?: number | null
          landing_page_views?: number | null
          add_to_cart?: number | null
          initiate_checkout?: number | null
          conversions?: number
          conversion_value?: number
          video_views?: number | null
          video_thruplays?: number | null
          search_impression_share?: number | null
          search_lost_is_budget?: number | null
          search_lost_is_rank?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_account_daily_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      insights_ad_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          ad_id: string
          date: string
          spend: number
          impressions: number
          reach: number | null
          clicks: number
          link_clicks: number | null
          conversions: number
          conversion_value: number
          video_views: number | null
          video_thruplays: number | null
          synced_at: string
          leads: number | null
          post_engagement: number | null
          post_reactions: number | null
          post_comments: number | null
          post_shares: number | null
          post_saves: number | null
          profile_visits: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          video_p95: number | null
          video_p100: number | null
          video_watch_seconds: number | null
          registrations: number | null
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          ad_id: string
          date: string
          spend?: number
          impressions?: number
          reach?: number | null
          clicks?: number
          link_clicks?: number | null
          conversions?: number
          conversion_value?: number
          video_views?: number | null
          video_thruplays?: number | null
          synced_at?: string
          leads?: number | null
          post_engagement?: number | null
          post_reactions?: number | null
          post_comments?: number | null
          post_shares?: number | null
          post_saves?: number | null
          profile_visits?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          video_p95?: number | null
          video_p100?: number | null
          video_watch_seconds?: number | null
          registrations?: number | null
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          ad_id?: string
          date?: string
          spend?: number
          impressions?: number
          reach?: number | null
          clicks?: number
          link_clicks?: number | null
          conversions?: number
          conversion_value?: number
          video_views?: number | null
          video_thruplays?: number | null
          synced_at?: string
          leads?: number | null
          post_engagement?: number | null
          post_reactions?: number | null
          post_comments?: number | null
          post_shares?: number | null
          post_saves?: number | null
          profile_visits?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          video_p95?: number | null
          video_p100?: number | null
          video_watch_seconds?: number | null
          registrations?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_ad_daily_workspace_id_ad_account_id_ad_id_fkey"
            columns: ["workspace_id","ad_account_id","ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["workspace_id","ad_account_id","id"]
          },
        ]
      }
      insights_breakdown_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          date: string
          dimension: string
          value: string
          spend: number
          impressions: number
          clicks: number
          conversions: number
          conversion_value: number
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          date: string
          dimension: string
          value: string
          spend?: number
          impressions?: number
          clicks?: number
          conversions?: number
          conversion_value?: number
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          date?: string
          dimension?: string
          value?: string
          spend?: number
          impressions?: number
          clicks?: number
          conversions?: number
          conversion_value?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_breakdown_daily_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      insights_campaign_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          campaign_id: string
          date: string
          spend: number
          impressions: number
          reach: number | null
          clicks: number
          link_clicks: number | null
          landing_page_views: number | null
          add_to_cart: number | null
          initiate_checkout: number | null
          conversions: number
          conversion_value: number
          video_views: number | null
          video_thruplays: number | null
          search_impression_share: number | null
          search_lost_is_budget: number | null
          search_lost_is_rank: number | null
          synced_at: string
          all_conversions: number | null
          interactions: number | null
          top_impression_pct: number | null
          absolute_top_impression_pct: number | null
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          campaign_id: string
          date: string
          spend?: number
          impressions?: number
          reach?: number | null
          clicks?: number
          link_clicks?: number | null
          landing_page_views?: number | null
          add_to_cart?: number | null
          initiate_checkout?: number | null
          conversions?: number
          conversion_value?: number
          video_views?: number | null
          video_thruplays?: number | null
          search_impression_share?: number | null
          search_lost_is_budget?: number | null
          search_lost_is_rank?: number | null
          synced_at?: string
          all_conversions?: number | null
          interactions?: number | null
          top_impression_pct?: number | null
          absolute_top_impression_pct?: number | null
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          campaign_id?: string
          date?: string
          spend?: number
          impressions?: number
          reach?: number | null
          clicks?: number
          link_clicks?: number | null
          landing_page_views?: number | null
          add_to_cart?: number | null
          initiate_checkout?: number | null
          conversions?: number
          conversion_value?: number
          video_views?: number | null
          video_thruplays?: number | null
          search_impression_share?: number | null
          search_lost_is_budget?: number | null
          search_lost_is_rank?: number | null
          synced_at?: string
          all_conversions?: number | null
          interactions?: number | null
          top_impression_pct?: number | null
          absolute_top_impression_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_campaign_daily_workspace_id_ad_account_id_campaig_fkey"
            columns: ["workspace_id","ad_account_id","campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["workspace_id","ad_account_id","id"]
          },
        ]
      }
      insights_product_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          product_id: string
          date: string
          impressions: number
          clicks: number
          spend: number
          conversions: number
          conversion_value: number
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          product_id: string
          date: string
          impressions?: number
          clicks?: number
          spend?: number
          conversions?: number
          conversion_value?: number
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          product_id?: string
          date?: string
          impressions?: number
          clicks?: number
          spend?: number
          conversions?: number
          conversion_value?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_product_daily_workspace_id_ad_account_id_product__fkey"
            columns: ["workspace_id","ad_account_id","product_id"]
            isOneToOne: false
            referencedRelation: "ad_products"
            referencedColumns: ["workspace_id","ad_account_id","id"]
          },
        ]
      }
      insights_search_term_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          campaign_id: string
          date: string
          search_term: string
          match_type: string
          impressions: number
          clicks: number
          spend: number
          conversions: number
          conversion_value: number
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          campaign_id: string
          date: string
          search_term: string
          match_type?: string
          impressions?: number
          clicks?: number
          spend?: number
          conversions?: number
          conversion_value?: number
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          campaign_id?: string
          date?: string
          search_term?: string
          match_type?: string
          impressions?: number
          clicks?: number
          spend?: number
          conversions?: number
          conversion_value?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_search_term_daily_workspace_id_ad_account_id_camp_fkey"
            columns: ["workspace_id","ad_account_id","campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["workspace_id","ad_account_id","id"]
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          workspace_id: string
          subscription_id: string | null
          checkout_session_id: string | null
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          currency: string
          subtotal_cents: number
          total_cents: number
          amount_paid_cents: number
          description: string | null
          lines: Json
          hosted_invoice_url: string | null
          invoice_pdf_url: string | null
          period_start: string | null
          period_end: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          subscription_id?: string | null
          checkout_session_id?: string | null
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_invoice_id?: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          currency?: string
          subtotal_cents: number
          total_cents: number
          amount_paid_cents?: number
          description?: string | null
          lines?: Json
          hosted_invoice_url?: string | null
          invoice_pdf_url?: string | null
          period_start?: string | null
          period_end?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          subscription_id?: string | null
          checkout_session_id?: string | null
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          currency?: string
          subtotal_cents?: number
          total_cents?: number
          amount_paid_cents?: number
          description?: string | null
          lines?: Json
          hosted_invoice_url?: string | null
          invoice_pdf_url?: string | null
          period_start?: string | null
          period_end?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_submissions: {
        Row: {
          id: string
          workspace_id: string
          landing_page_id: string
          data: Json
          utm: Json
          referrer: string | null
          ip: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          landing_page_id: string
          data: Json
          utm?: Json
          referrer?: string | null
          ip?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          landing_page_id?: string
          data?: Json
          utm?: Json
          referrer?: string | null
          ip?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_submissions_workspace_id_landing_page_id_fkey"
            columns: ["workspace_id","landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      landing_page_versions: {
        Row: {
          id: string
          workspace_id: string
          landing_page_id: string
          version: number
          content: Json
          tracking: Json
          published_by: string | null
          published_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          landing_page_id: string
          version: number
          content: Json
          tracking?: Json
          published_by?: string | null
          published_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          landing_page_id?: string
          version?: number
          content?: Json
          tracking?: Json
          published_by?: string | null
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_versions_workspace_id_landing_page_id_fkey"
            columns: ["workspace_id","landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          id: string
          workspace_id: string
          template_id: string
          name: string
          slug: string
          content: Json
          gtm_container_id: string | null
          meta_pixel_id: string | null
          google_ads_conversion: string | null
          ga4_measurement_id: string | null
          status: Database["public"]["Enums"]["landing_status"]
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          template_id: string
          name?: string
          slug: string
          content?: Json
          gtm_container_id?: string | null
          meta_pixel_id?: string | null
          google_ads_conversion?: string | null
          ga4_measurement_id?: string | null
          status?: Database["public"]["Enums"]["landing_status"]
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          template_id?: string
          name?: string
          slug?: string
          content?: Json
          gtm_container_id?: string | null
          meta_pixel_id?: string | null
          google_ads_conversion?: string | null
          ga4_measurement_id?: string | null
          status?: Database["public"]["Enums"]["landing_status"]
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "landing_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_templates: {
        Row: {
          id: string
          name: string
          description: string
          category: string
          min_plan_id: string
          sort: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string
          category: string
          min_plan_id: string
          sort?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          category?: string
          min_plan_id?: string
          sort?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_templates_min_plan_id_fkey"
            columns: ["min_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_waitlist: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          email: string
          use_case: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          email: string
          use_case?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          email?: string
          use_case?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_waitlist_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_waitlist_visits: {
        Row: {
          id: number
          workspace_id: string
          visited_at: string
        }
        Insert: {
          id?: never
          workspace_id: string
          visited_at?: string
        }
        Update: {
          id?: never
          workspace_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_waitlist_visits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          id: string
          user_id: string
          email: string
          document: string
          document_version: string
          accepted: boolean
          checkout_session_id: string | null
          ip: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          document: string
          document_version: string
          accepted?: boolean
          checkout_session_id?: string | null
          ip?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          document?: string
          document_version?: string
          accepted?: boolean
          checkout_session_id?: string | null
          ip?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          id: string
          state_hash: string
          workspace_id: string
          user_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          code_verifier: string | null
          redirect_path: string
          expires_at: string
          consumed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          state_hash: string
          workspace_id: string
          user_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          code_verifier?: string | null
          redirect_path?: string
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          state_hash?: string
          workspace_id?: string
          user_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          code_verifier?: string | null
          redirect_path?: string
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_autopilot: {
        Row: {
          workspace_id: string
          project_id: string
          enabled: boolean
          max_budget_change_pct: number
          allow_increase: boolean
          allow_pause: boolean
          min_campaign_age_days: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          workspace_id: string
          project_id: string
          enabled?: boolean
          max_budget_change_pct?: number
          allow_increase?: boolean
          allow_pause?: boolean
          min_campaign_age_days?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          project_id?: string
          enabled?: boolean
          max_budget_change_pct?: number
          allow_increase?: boolean
          allow_pause?: boolean
          min_campaign_age_days?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_autopilot_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_autopilot_workspace_id_project_id_fkey"
            columns: ["workspace_id","project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      optimization_runs: {
        Row: {
          id: string
          workspace_id: string
          task_id: string | null
          project_id: string | null
          campaign_id: string | null
          platform: string
          kind: string
          action: Json
          mode: string
          status: string
          error: string | null
          is_mock: boolean
          applied_by: string | null
          applied_at: string
          undone_by: string | null
          undone_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          task_id?: string | null
          project_id?: string | null
          campaign_id?: string | null
          platform: string
          kind: string
          action: Json
          mode: string
          status: string
          error?: string | null
          is_mock?: boolean
          applied_by?: string | null
          applied_at?: string
          undone_by?: string | null
          undone_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          task_id?: string | null
          project_id?: string | null
          campaign_id?: string | null
          platform?: string
          kind?: string
          action?: Json
          mode?: string
          status?: string
          error?: string | null
          is_mock?: boolean
          applied_by?: string | null
          applied_at?: string
          undone_by?: string | null
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_daily: {
        Row: {
          workspace_id: string
          ad_account_id: string
          date: string
          followers: number | null
          follows: number | null
          unfollows: number | null
          views: number
          reach: number | null
          profile_views: number | null
          accounts_engaged: number | null
          interactions: number
          likes: number | null
          comments: number | null
          shares: number | null
          saves: number | null
          link_clicks: number | null
          posts: number
          synced_at: string
        }
        Insert: {
          workspace_id: string
          ad_account_id: string
          date: string
          followers?: number | null
          follows?: number | null
          unfollows?: number | null
          views?: number
          reach?: number | null
          profile_views?: number | null
          accounts_engaged?: number | null
          interactions?: number
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          link_clicks?: number | null
          posts?: number
          synced_at?: string
        }
        Update: {
          workspace_id?: string
          ad_account_id?: string
          date?: string
          followers?: number | null
          follows?: number | null
          unfollows?: number | null
          views?: number
          reach?: number | null
          profile_views?: number | null
          accounts_engaged?: number | null
          interactions?: number
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          link_clicks?: number | null
          posts?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_daily_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      organic_posts: {
        Row: {
          id: string
          workspace_id: string
          ad_account_id: string
          external_id: string
          kind: string
          caption: string | null
          permalink: string | null
          thumbnail_url: string | null
          published_at: string
          views: number | null
          reach: number | null
          likes: number | null
          comments: number | null
          shares: number | null
          saves: number | null
          interactions: number
          synced_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          ad_account_id: string
          external_id: string
          kind: string
          caption?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          published_at: string
          views?: number | null
          reach?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          interactions?: number
          synced_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          ad_account_id?: string
          external_id?: string
          kind?: string
          caption?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          published_at?: string
          views?: number | null
          reach?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          interactions?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_posts_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          id: string
          workspace_id: string | null
          invoice_id: string | null
          checkout_session_id: string | null
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_payment_id: string | null
          kind: string
          status: string
          amount_cents: number
          currency: string
          method: string | null
          card_brand: string | null
          card_last4: string | null
          installments: number | null
          failure_code: string | null
          failure_message: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          invoice_id?: string | null
          checkout_session_id?: string | null
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_payment_id?: string | null
          kind?: string
          status: string
          amount_cents: number
          currency?: string
          method?: string | null
          card_brand?: string | null
          card_last4?: string | null
          installments?: number | null
          failure_code?: string | null
          failure_message?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          invoice_id?: string | null
          checkout_session_id?: string | null
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_payment_id?: string | null
          kind?: string
          status?: string
          amount_cents?: number
          currency?: string
          method?: string | null
          card_brand?: string | null
          card_last4?: string | null
          installments?: number | null
          failure_code?: string | null
          failure_message?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          plan_id: string
          dashboard_templates: number
          landing_templates: number
          platforms: string
          pages_plan_id: string
          white_label: boolean
          audio: string
          custom_dashboards: boolean
          agent_chat: boolean
          agent_voice: boolean
          max_dashboards: number
          max_landing_pages: number
          updated_at: string
          max_members: number
          max_accounts_per_platform: number
        }
        Insert: {
          plan_id: string
          dashboard_templates: number
          landing_templates: number
          platforms: string
          pages_plan_id: string
          white_label: boolean
          audio: string
          custom_dashboards: boolean
          agent_chat: boolean
          agent_voice: boolean
          max_dashboards: number
          max_landing_pages: number
          updated_at?: string
          max_members?: number
          max_accounts_per_platform?: number
        }
        Update: {
          plan_id?: string
          dashboard_templates?: number
          landing_templates?: number
          platforms?: string
          pages_plan_id?: string
          white_label?: boolean
          audio?: string
          custom_dashboards?: boolean
          agent_chat?: boolean
          agent_voice?: boolean
          max_dashboards?: number
          max_landing_pages?: number
          updated_at?: string
          max_members?: number
          max_accounts_per_platform?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_pages_plan_id_fkey"
            columns: ["pages_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          id: string
          plan_id: string
          interval: Database["public"]["Enums"]["billing_interval"]
          currency: string
          first_account_cents: number
          extra_account_cents: number
          addon_cents: number
          stripe_price_id: string | null
          stripe_addon_price_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          plan_id: string
          interval: Database["public"]["Enums"]["billing_interval"]
          currency?: string
          first_account_cents: number
          extra_account_cents: number
          addon_cents?: number
          stripe_price_id?: string | null
          stripe_addon_price_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          interval?: Database["public"]["Enums"]["billing_interval"]
          currency?: string
          first_account_cents?: number
          extra_account_cents?: number
          addon_cents?: number
          stripe_price_id?: string | null
          stripe_addon_price_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          id: string
          name: string
          rank: number
          self_serve: boolean
          is_active: boolean
          stripe_product_id: string | null
          created_at: string
          updated_at: string
          product: Database["public"]["Enums"]["product_line"]
        }
        Insert: {
          id: string
          name: string
          rank: number
          self_serve?: boolean
          is_active?: boolean
          stripe_product_id?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Update: {
          id?: string
          name?: string
          rank?: number
          self_serve?: boolean
          is_active?: boolean
          stripe_product_id?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Relationships: []
      }
      platforms: {
        Row: {
          id: string
          name: string
          short_name: string
          kind: string
          min_plan_id: string
          oauth_provider: Database["public"]["Enums"]["integration_provider"] | null
          connect_available: boolean
          sort: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          short_name: string
          kind: string
          min_plan_id: string
          oauth_provider?: Database["public"]["Enums"]["integration_provider"] | null
          connect_available?: boolean
          sort?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          short_name?: string
          kind?: string
          min_plan_id?: string
          oauth_provider?: Database["public"]["Enums"]["integration_provider"] | null
          connect_available?: boolean
          sort?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platforms_min_plan_id_fkey"
            columns: ["min_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          id: number
          user_id: string
          workspace_id: string | null
          product: Database["public"]["Enums"]["product_line"]
          source: string
          checkout_session_id: string | null
          created_at: string
        }
        Insert: {
          id?: never
          user_id: string
          workspace_id?: string | null
          product: Database["public"]["Enums"]["product_line"]
          source: string
          checkout_session_id?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          user_id?: string
          workspace_id?: string | null
          product?: Database["public"]["Enums"]["product_line"]
          source?: string
          checkout_session_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          phone: string | null
          default_workspace_id: string | null
          created_at: string
          updated_at: string
          product: Database["public"]["Enums"]["product_line"] | null
        }
        Insert: {
          id: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          phone?: string | null
          default_workspace_id?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"] | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          phone?: string | null
          default_workspace_id?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_workspace_fk"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          workspace_id: string
          project_id: string
          user_id: string
          added_by: string | null
          created_at: string
        }
        Insert: {
          workspace_id: string
          project_id: string
          user_id: string
          added_by?: string | null
          created_at?: string
        }
        Update: {
          workspace_id?: string
          project_id?: string
          user_id?: string
          added_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_workspace_id_project_id_fkey"
            columns: ["workspace_id","project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "project_members_workspace_id_user_id_fkey"
            columns: ["workspace_id","user_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["workspace_id","user_id"]
          },
        ]
      }
      projects: {
        Row: {
          id: string
          workspace_id: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          platform: string
          token: string
          app_version: string | null
          created_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          token: string
          app_version?: string | null
          created_at?: string
          last_seen_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          token?: string
          app_version?: string | null
          created_at?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          window_start: string
          hits: number
        }
        Insert: {
          bucket: string
          window_start: string
          hits?: number
        }
        Update: {
          bucket?: string
          window_start?: string
          hits?: number
        }
        Relationships: []
      }
      report_deliveries: {
        Row: {
          id: string
          workspace_id: string
          report_id: string | null
          dashboard_id: string | null
          status: string
          channel: string
          recipients_count: number
          period_start: string | null
          period_end: string | null
          error: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          report_id?: string | null
          dashboard_id?: string | null
          status: string
          channel: string
          recipients_count?: number
          period_start?: string | null
          period_end?: string | null
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          report_id?: string | null
          dashboard_id?: string | null
          status?: string
          channel?: string
          recipients_count?: number
          period_start?: string | null
          period_end?: string | null
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_deliveries_workspace_id_dashboard_id_fkey"
            columns: ["workspace_id","dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "report_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_workspace_id_report_id_fkey"
            columns: ["workspace_id","report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      scheduled_report_recipients: {
        Row: {
          id: string
          workspace_id: string
          report_id: string
          channel: string
          address: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          report_id: string
          channel: string
          address: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          report_id?: string
          channel?: string
          address?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_report_recipients_workspace_id_report_id_fkey"
            columns: ["workspace_id","report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          id: string
          workspace_id: string
          dashboard_id: string
          frequency: Database["public"]["Enums"]["report_frequency"]
          weekday: number | null
          month_day: number | null
          format: Database["public"]["Enums"]["report_format"]
          send_hour: number
          timezone: string
          is_active: boolean
          next_run_at: string | null
          last_run_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          dashboard_id: string
          frequency: Database["public"]["Enums"]["report_frequency"]
          weekday?: number | null
          month_day?: number | null
          format: Database["public"]["Enums"]["report_format"]
          send_hour?: number
          timezone?: string
          is_active?: boolean
          next_run_at?: string | null
          last_run_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          dashboard_id?: string
          frequency?: Database["public"]["Enums"]["report_frequency"]
          weekday?: number | null
          month_day?: number | null
          format?: Database["public"]["Enums"]["report_format"]
          send_hour?: number
          timezone?: string
          is_active?: boolean
          next_run_at?: string | null
          last_run_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_workspace_id_dashboard_id_fkey"
            columns: ["workspace_id","dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      service_orders: {
        Row: {
          id: string
          workspace_id: string
          checkout_session_id: string | null
          billing_item_id: string
          quantity: number
          status: Database["public"]["Enums"]["service_order_status"]
          notes: string | null
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          checkout_session_id?: string | null
          billing_item_id: string
          quantity: number
          status?: Database["public"]["Enums"]["service_order_status"]
          notes?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          checkout_session_id?: string | null
          billing_item_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["service_order_status"]
          notes?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_billing_item_id_fkey"
            columns: ["billing_item_id"]
            isOneToOne: false
            referencedRelation: "billing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          id: string
          workspace_id: string
          dashboard_id: string
          token_hash: string
          token_hint: string
          hide_spend: boolean
          expires_at: string | null
          revoked_at: string | null
          view_count: number
          last_viewed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          dashboard_id: string
          token_hash: string
          token_hint: string
          hide_spend?: boolean
          expires_at?: string | null
          revoked_at?: string | null
          view_count?: number
          last_viewed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          dashboard_id?: string
          token_hash?: string
          token_hint?: string
          hide_spend?: boolean
          expires_at?: string | null
          revoked_at?: string | null
          view_count?: number
          last_viewed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_workspace_id_dashboard_id_fkey"
            columns: ["workspace_id","dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      store_customers: {
        Row: {
          user_id: string
          workspace_id: string
          updated_at: string
        }
        Insert: {
          user_id: string
          workspace_id: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          workspace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      store_events: {
        Row: {
          id: string
          type: string
          app_user_id: string | null
          payload: Json
          received_at: string
          processed_at: string | null
          error: string | null
        }
        Insert: {
          id: string
          type: string
          app_user_id?: string | null
          payload: Json
          received_at?: string
          processed_at?: string | null
          error?: string | null
        }
        Update: {
          id?: string
          type?: string
          app_user_id?: string | null
          payload?: Json
          received_at?: string
          processed_at?: string | null
          error?: string | null
        }
        Relationships: []
      }
      subscription_changes: {
        Row: {
          id: number
          workspace_id: string
          subscription_id: string
          change: string
          from_value: string | null
          to_value: string | null
          actor_id: string | null
          created_at: string
        }
        Insert: {
          id?: never
          workspace_id: string
          subscription_id: string
          change: string
          from_value?: string | null
          to_value?: string | null
          actor_id?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          workspace_id?: string
          subscription_id?: string
          change?: string
          from_value?: string | null
          to_value?: string | null
          actor_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      subscription_items: {
        Row: {
          id: string
          workspace_id: string
          subscription_id: string
          plan_price_id: string | null
          billing_item_id: string | null
          quantity: number
          amount_cents: number
          provider_item_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          subscription_id: string
          plan_price_id?: string | null
          billing_item_id?: string | null
          quantity: number
          amount_cents: number
          provider_item_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          subscription_id?: string
          plan_price_id?: string | null
          billing_item_id?: string | null
          quantity?: number
          amount_cents?: number
          provider_item_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_billing_item_id_fkey"
            columns: ["billing_item_id"]
            isOneToOne: false
            referencedRelation: "billing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_workspace_id_subscription_id_fkey"
            columns: ["workspace_id","subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["workspace_id","id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          workspace_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          interval: Database["public"]["Enums"]["billing_interval"]
          accounts_quantity: number
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_subscription_id: string | null
          checkout_session_id: string | null
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          ended_at: string | null
          trial_end: string | null
          metadata: Json
          created_at: string
          updated_at: string
          product: Database["public"]["Enums"]["product_line"]
        }
        Insert: {
          id?: string
          workspace_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          interval: Database["public"]["Enums"]["billing_interval"]
          accounts_quantity: number
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_subscription_id?: string | null
          checkout_session_id?: string | null
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          ended_at?: string | null
          trial_end?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Update: {
          id?: string
          workspace_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          interval?: Database["public"]["Enums"]["billing_interval"]
          accounts_quantity?: number
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_subscription_id?: string | null
          checkout_session_id?: string | null
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          ended_at?: string | null
          trial_end?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          id: string
          workspace_id: string
          connection_id: string | null
          ad_account_id: string | null
          trigger: string
          status: Database["public"]["Enums"]["sync_status"]
          range_start: string | null
          range_end: string | null
          rows_written: number
          error: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          connection_id?: string | null
          ad_account_id?: string | null
          trigger: string
          status?: Database["public"]["Enums"]["sync_status"]
          range_start?: string | null
          range_end?: string | null
          rows_written?: number
          error?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          connection_id?: string | null
          ad_account_id?: string | null
          trigger?: string
          status?: Database["public"]["Enums"]["sync_status"]
          range_start?: string | null
          range_end?: string | null
          rows_written?: number
          error?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_workspace_id_ad_account_id_fkey"
            columns: ["workspace_id","ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "sync_runs_workspace_id_connection_id_fkey"
            columns: ["workspace_id","connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "sync_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_automation_runs: {
        Row: {
          workspace_id: string
          generated_at: string
          created_count: number
          closed_count: number
        }
        Insert: {
          workspace_id: string
          generated_at?: string
          created_count?: number
          closed_count?: number
        }
        Update: {
          workspace_id?: string
          generated_at?: string
          created_count?: number
          closed_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_automation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          id: string
          workspace_id: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          project_id: string | null
          group_id: string | null
          dashboard_id: string | null
          platform: string | null
          title: string
          detail: string | null
          status: string
          stage: string
          priority: string
          start_date: string | null
          due_date: string | null
          assignees: string[]
          source: string
          insight_key: string | null
          auto_note: string | null
          seen_at: string | null
          edited_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          action: Json | null
        }
        Insert: {
          id?: string
          workspace_id: string
          project_id?: string | null
          group_id?: string | null
          dashboard_id?: string | null
          platform?: string | null
          title: string
          detail?: string | null
          status?: string
          stage?: string
          priority?: string
          start_date?: string | null
          due_date?: string | null
          assignees?: string[]
          source?: string
          insight_key?: string | null
          auto_note?: string | null
          seen_at?: string | null
          edited_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          action?: Json | null
        }
        Update: {
          id?: string
          workspace_id?: string
          project_id?: string | null
          group_id?: string | null
          dashboard_id?: string | null
          platform?: string | null
          title?: string
          detail?: string | null
          status?: string
          stage?: string
          priority?: string
          start_date?: string | null
          due_date?: string | null
          assignees?: string[]
          source?: string
          insight_key?: string | null
          auto_note?: string | null
          seen_at?: string | null
          edited_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          action?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_group_fk"
            columns: ["workspace_id","group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "tasks_project_fk"
            columns: ["workspace_id","project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id","id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_guides: {
        Row: {
          user_id: string
          guide: string
          status: string
          snoozed_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          guide: string
          status: string
          snoozed_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          guide?: string
          status?: string
          snoozed_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_guides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          id: string
          subscription_id: string | null
          direction: string
          kind: string
          template: string | null
          status: string
          provider_message_id: string | null
          ref_key: string | null
          body: string | null
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subscription_id?: string | null
          direction: string
          kind: string
          template?: string | null
          status: string
          provider_message_id?: string | null
          ref_key?: string | null
          body?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string | null
          direction?: string
          kind?: string
          template?: string | null
          status?: string
          provider_message_id?: string | null
          ref_key?: string | null
          body?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_subscriptions: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          phone: string
          verified_at: string | null
          opted_in_at: string | null
          opt_in_source: string | null
          opted_out_at: string | null
          reports: string[]
          paused: boolean
          welcome_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          phone: string
          verified_at?: string | null
          opted_in_at?: string | null
          opt_in_source?: string | null
          opted_out_at?: string | null
          reports?: string[]
          paused?: boolean
          welcome_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          phone?: string
          verified_at?: string | null
          opted_in_at?: string | null
          opt_in_source?: string | null
          opted_out_at?: string | null
          reports?: string[]
          paused?: boolean
          welcome_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_verification_codes: {
        Row: {
          id: string
          subscription_id: string
          phone: string
          code_hash: string
          expires_at: string
          attempts: number
          consumed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          phone: string
          code_hash: string
          expires_at: string
          attempts?: number
          consumed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string
          phone?: string
          code_hash?: string
          expires_at?: string
          attempts?: number
          consumed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_verification_codes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
          invited_by: string | null
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          revoked_at: string | null
          created_at: string
          project_ids: string[]
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
          created_at?: string
          project_ids?: string[]
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
          created_at?: string
          project_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: Database["public"]["Enums"]["member_role"]
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_platforms: {
        Row: {
          workspace_id: string
          platform_id: string
          created_at: string
        }
        Insert: {
          workspace_id: string
          platform_id: string
          created_at?: string
        }
        Update: {
          workspace_id?: string
          platform_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_platforms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          business_type_id: string | null
          brand_color: string
          brand_logo_path: string | null
          hide_vyz_brand: boolean
          timezone: string
          currency: string
          onboarding_step: Database["public"]["Enums"]["onboarding_step"]
          onboarding_completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          product: Database["public"]["Enums"]["product_line"]
        }
        Insert: {
          id?: string
          name: string
          slug: string
          business_type_id?: string | null
          brand_color?: string
          brand_logo_path?: string | null
          hide_vyz_brand?: boolean
          timezone?: string
          currency?: string
          onboarding_step?: Database["public"]["Enums"]["onboarding_step"]
          onboarding_completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          business_type_id?: string | null
          brand_color?: string
          brand_logo_path?: string | null
          hide_vyz_brand?: boolean
          timezone?: string
          currency?: string
          onboarding_step?: Database["public"]["Enums"]["onboarding_step"]
          onboarding_completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          product?: Database["public"]["Enums"]["product_line"]
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_business_type_id_fkey"
            columns: ["business_type_id"]
            isOneToOne: false
            referencedRelation: "business_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      credit_balances: {
        Row: {
          user_id: string | null
          balance: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      workspace_access: {
        Row: {
          workspace_id: string | null
          subscription_id: string | null
          plan_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"] | null
          interval: Database["public"]["Enums"]["billing_interval"] | null
          accounts_quantity: number | null
          current_period_end: string | null
          cancel_at_period_end: boolean | null
          has_access: boolean | null
          dashboard_templates: number | null
          landing_templates: number | null
          platforms: string | null
          pages_plan_id: string | null
          white_label: boolean | null
          audio: string | null
          custom_dashboards: boolean | null
          agent_chat: boolean | null
          agent_voice: boolean | null
          max_dashboards: number | null
          max_landing_pages: number | null
          hide_vyz_brand_effective: boolean | null
          max_members: number | null
          provider: Database["public"]["Enums"]["billing_provider"] | null
          product: Database["public"]["Enums"]["product_line"] | null
        }
        Relationships: []
      }
      workspace_usage: {
        Row: {
          workspace_id: string | null
          dashboards: number | null
          landing_pages: number | null
          published_landing_pages: number | null
          enabled_ad_accounts: number | null
          billable_accounts: number | null
          active_connections: number | null
          projects: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_workspace_invitation: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      change_subscription: {
        Args: {
          p_subscription_id: string
          p_plan_id: string
          p_interval: Database["public"]["Enums"]["billing_interval"]
          p_accounts: number
          p_plan_amount_cents: number
          p_period_start?: string
          p_period_end?: string
          p_invoice?: Json
          p_payment?: Json
        }
        Returns: string
      }
      connection_tokens_read: {
        Args: {
          p_connection_id: string
        }
        Returns: {
            access_token: string
            refresh_token: string
            token_expires_at: string
          }[]
      }
      connection_tokens_save: {
        Args: {
          p_connection_id: string
          p_access_token: string
          p_refresh_token: string
          p_token_expires_at: string
        }
        Returns: undefined
      }
      create_dashboard: {
        Args: {
          p_workspace_id: string
          p_template_id: string
          p_name: string
          p_client_name?: string
          p_settings?: Json
          p_page_type_ids?: string[]
          p_ad_account_ids?: string[]
        }
        Returns: string
      }
      credit_store_purchase: {
        Args: {
          p_event_id: string
          p_user_id: string
          p_store: string
          p_product_id: string
          p_transaction_id: string
          p_credits: number
          p_reason?: string
        }
        Returns: boolean
      }
      fulfill_checkout: {
        Args: {
          p_checkout_id: string
          p_provider_customer_id: string
          p_provider_subscription_id?: string
          p_provider_invoice_id?: string
          p_payment?: Json
          p_period_start?: string
          p_period_end?: string
        }
        Returns: string
      }
      integration_connect: {
        Args: {
          p_workspace_id: string
          p_provider: Database["public"]["Enums"]["integration_provider"]
          p_external_user_id: string
          p_external_user_name: string
          p_external_user_email: string
          p_scopes: string[]
          p_is_mock: boolean
          p_connected_by: string
          p_access_token: string
          p_refresh_token: string
          p_token_expires_at: string
          p_accounts: Json
        }
        Returns: string
      }
      mmm_backfill_control: {
        Args: {
          p_ativo?: boolean
          p_by?: string
        }
        Returns: Json
      }
      mmm_claim_backfill: {
        Args: {
          p_limit?: number
        }
        Returns: {
            id: number
            workspace_id: string
            ad_account_id: string
            platform_id: string
            mes: string
            status: string
            tentativas: number
            report_run_id: string
          }[]
      }
      mmm_enqueue_backfill: {
        Args: {
          p_months?: number
          p_requested_by?: string
        }
        Returns: number
      }
      mmm_google_ops_today: {
        Args: never
        Returns: number
      }
      mmm_save_backfill: {
        Args: {
          p_id: number
          p_raw: Json
          p_rows: Json
        }
        Returns: number
      }
      mmm_update_backfill: {
        Args: {
          p_id: number
          p_status: string
          p_erro?: string
          p_report_run_id?: string
          p_refund?: boolean
        }
        Returns: undefined
      }
      prepare_account_deletion: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      public_link_exists: {
        Args: {
          p_kind: string
          p_key: string
        }
        Returns: boolean
      }
      rate_limit_hit: {
        Args: {
          p_bucket: string
          p_window_seconds: number
          p_max: number
        }
        Returns: boolean
      }
      rls_auto_enable: {
        Args: never
        Returns: unknown
      }
      rollup_account_insights: {
        Args: {
          p_ad_account_id: string
          p_from: string
          p_to: string
        }
        Returns: number
      }
      set_dashboard_pages: {
        Args: {
          p_dashboard_id: string
          p_page_type_ids: string[]
        }
        Returns: undefined
      }
      set_dashboard_sources: {
        Args: {
          p_dashboard_id: string
          p_ad_account_ids: string[]
        }
        Returns: undefined
      }
      set_enabled_ad_accounts: {
        Args: {
          p_workspace_id: string
          p_platform_id: string
          p_ad_account_ids: string[]
        }
        Returns: number
      }
      sync_store_subscription: {
        Args: {
          p_user_id: string
          p_store: string
          p_plan_id: string
          p_interval: Database["public"]["Enums"]["billing_interval"]
          p_accounts: number
          p_status: Database["public"]["Enums"]["subscription_status"]
          p_period_start: string
          p_period_end: string
          p_cancel_at_period_end: boolean
        }
        Returns: string
      }
      user_project_ids: {
        Args: {
          p_workspace_id: string
          p_user_id: string
        }
        Returns: string[]
      }
    }
    Enums: {
      billing_interval: "month" | "year"
      billing_provider: "mock" | "stripe" | "app_store" | "play_store"
      checkout_status: "open" | "completed" | "expired" | "canceled"
      connection_status: "active" | "expired" | "revoked" | "error"
      integration_provider: "meta" | "google" | "ga4" | "tiktok" | "linkedin" | "mercado" | "rdstation" | "hubspot" | "pipedrive" | "kommo"
      invoice_status: "draft" | "open" | "paid" | "void" | "uncollectible"
      landing_status: "draft" | "published" | "archived"
      member_role: "viewer" | "member" | "admin" | "owner"
      onboarding_step: "business" | "platforms" | "connect" | "dashboard" | "done"
      product_line: "dash" | "lp"
      report_format: "pdf" | "whatsapp"
      report_frequency: "weekly" | "monthly"
      service_order_status: "pending" | "in_progress" | "delivered" | "canceled"
      subscription_status: "trialing" | "active" | "past_due" | "unpaid" | "paused" | "incomplete" | "incomplete_expired" | "canceled"
      sync_status: "queued" | "running" | "succeeded" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> = (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T] extends { Update: infer U } ? U : never
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type FunctionArgs<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Args"]
export type FunctionReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"]

export const Constants = {
  public: {
    Enums: {
      billing_interval: ["month", "year"],
      billing_provider: ["mock", "stripe", "app_store", "play_store"],
      checkout_status: ["open", "completed", "expired", "canceled"],
      connection_status: ["active", "expired", "revoked", "error"],
      integration_provider: ["meta", "google", "ga4", "tiktok", "linkedin", "mercado", "rdstation", "hubspot", "pipedrive", "kommo"],
      invoice_status: ["draft", "open", "paid", "void", "uncollectible"],
      landing_status: ["draft", "published", "archived"],
      member_role: ["viewer", "member", "admin", "owner"],
      onboarding_step: ["business", "platforms", "connect", "dashboard", "done"],
      product_line: ["dash", "lp"],
      report_format: ["pdf", "whatsapp"],
      report_frequency: ["weekly", "monthly"],
      service_order_status: ["pending", "in_progress", "delivered", "canceled"],
      subscription_status: ["trialing", "active", "past_due", "unpaid", "paused", "incomplete", "incomplete_expired", "canceled"],
      sync_status: ["queued", "running", "succeeded", "failed"],
    },
  },
} as const
