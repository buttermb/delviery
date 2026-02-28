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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_logs: {
        Row: {
          action_type: string
          created_at: string | null
          description: string | null
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          performed_by: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      account_settings: {
        Row: {
          account_id: string
          branding: Json | null
          business_license: string | null
          compliance_settings: Json | null
          created_at: string | null
          id: string
          integration_settings: Json | null
          notification_settings: Json | null
          operating_states: string[] | null
          state: string | null
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          branding?: Json | null
          business_license?: string | null
          compliance_settings?: Json | null
          created_at?: string | null
          id?: string
          integration_settings?: Json | null
          notification_settings?: Json | null
          operating_states?: string[] | null
          state?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          branding?: Json | null
          business_license?: string | null
          compliance_settings?: Json | null
          created_at?: string | null
          id?: string
          integration_settings?: Json | null
          notification_settings?: Json | null
          operating_states?: string[] | null
          state?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          billing_email: string | null
          company_name: string
          created_at: string | null
          id: string
          metadata: Json | null
          plan_id: string | null
          slug: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          billing_email?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          slug: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_email?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          slug?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      action_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          account_id: string
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          apartment: string | null
          borough: string
          city: string
          coordinates: Json | null
          created_at: string | null
          delivery_count: number | null
          id: string
          is_default: boolean | null
          issue_count: number | null
          lat: number | null
          latitude: number | null
          lng: number | null
          longitude: number | null
          neighborhood: string | null
          risk_zone: string | null
          state: string
          street: string
          user_id: string | null
          verified: boolean | null
          zip_code: string
        }
        Insert: {
          apartment?: string | null
          borough: string
          city?: string
          coordinates?: Json | null
          created_at?: string | null
          delivery_count?: number | null
          id?: string
          is_default?: boolean | null
          issue_count?: number | null
          lat?: number | null
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          neighborhood?: string | null
          risk_zone?: string | null
          state?: string
          street: string
          user_id?: string | null
          verified?: boolean | null
          zip_code: string
        }
        Update: {
          apartment?: string | null
          borough?: string
          city?: string
          coordinates?: Json | null
          created_at?: string | null
          delivery_count?: number | null
          id?: string
          is_default?: boolean | null
          issue_count?: number | null
          lat?: number | null
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          neighborhood?: string | null
          risk_zone?: string | null
          state?: string
          street?: string
          user_id?: string | null
          verified?: boolean | null
          zip_code?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          admin_id: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      age_verifications: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string | null
          id_type: string | null
          selfie_url: string | null
          user_id: string
          verification_method: string
          verification_type: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          selfie_url?: string | null
          user_id: string
          verification_method: string
          verification_type: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          selfie_url?: string | null
          user_id?: string
          verification_method?: string
          verification_type?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key: string
          last_used_at: string | null
          name: string
          permissions: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_time_ms: number | null
          status_code: number | null
          tenant_id: string | null
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          response_time_ms?: number | null
          status_code?: number | null
          tenant_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
          tenant_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      application_logs: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          log_level: string | null
          message: string
          page_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          log_level?: string | null
          message: string
          page_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          log_level?: string | null
          message?: string
          page_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          account_id: string
          appointment_type: string
          created_at: string | null
          customer_id: string
          duration_minutes: number | null
          id: string
          location_id: string | null
          notes: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          staff_member_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          appointment_type: string
          created_at?: string | null
          customer_id: string
          duration_minutes?: number | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          staff_member_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          appointment_type?: string
          created_at?: string | null
          customer_id?: string
          duration_minutes?: number | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          staff_member_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string | null
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_type: string | null
          tenant_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_type?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_type?: string | null
          tenant_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_type?: string | null
          tenant_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          tenant_id: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          tenant_id: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          tenant_id?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      barcode_labels: {
        Row: {
          account_id: string
          barcode: string
          barcode_type: string | null
          created_at: string | null
          id: string
          label_size: string | null
          label_template_id: string | null
          printed_at: string | null
          product_id: string | null
          status: string | null
        }
        Insert: {
          account_id: string
          barcode: string
          barcode_type?: string | null
          created_at?: string | null
          id?: string
          label_size?: string | null
          label_template_id?: string | null
          printed_at?: string | null
          product_id?: string | null
          status?: string | null
        }
        Update: {
          account_id?: string
          barcode?: string
          barcode_type?: string | null
          created_at?: string | null
          id?: string
          label_size?: string | null
          label_template_id?: string | null
          printed_at?: string | null
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barcode_labels_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barcode_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_recalls: {
        Row: {
          affected_customers: number | null
          batch_number: string
          created_by: string | null
          id: string
          initiated_at: string | null
          product_id: string | null
          product_name: string
          recall_reason: string
          resolved_at: string | null
          scope: string | null
          severity: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          affected_customers?: number | null
          batch_number: string
          created_by?: string | null
          id?: string
          initiated_at?: string | null
          product_id?: string | null
          product_name: string
          recall_reason: string
          resolved_at?: string | null
          scope?: string | null
          severity?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          affected_customers?: number | null
          batch_number?: string
          created_by?: string | null
          id?: string
          initiated_at?: string | null
          product_id?: string | null
          product_name?: string
          recall_reason?: string
          resolved_at?: string | null
          scope?: string | null
          severity?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_recalls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_recalls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_devices: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          fingerprint: string
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          fingerprint: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          fingerprint?: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          expires_at: string | null
          id: string
          ip_address: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          expires_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          published: boolean | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          selected_weight: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          selected_weight?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          selected_weight?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string | null
          sender_type: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id?: string | null
          sender_type: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string | null
          sender_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          assigned_admin_id: string | null
          created_at: string | null
          guest_id: string | null
          id: string
          mode: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          created_at?: string | null
          guest_id?: string | null
          id?: string
          mode?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          created_at?: string | null
          guest_id?: string | null
          id?: string
          mode?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collection_activities: {
        Row: {
          activity_type: string
          amount: number | null
          client_id: string
          created_at: string | null
          id: string
          notes: string | null
          performed_by: string | null
          tenant_id: string | null
        }
        Insert: {
          activity_type: string
          amount?: number | null
          client_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          activity_type?: string
          amount?: number | null
          client_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_transactions: {
        Row: {
          commission_amount: number
          commission_rate: number | null
          created_at: string | null
          customer_payment_amount: number
          id: string
          order_id: string | null
          paid_at: string | null
          processed_at: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          commission_amount?: number
          commission_rate?: number | null
          created_at?: string | null
          customer_payment_amount?: number
          id?: string
          order_id?: string | null
          paid_at?: string | null
          processed_at?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          commission_amount?: number
          commission_rate?: number | null
          created_at?: string | null
          customer_payment_amount?: number
          id?: string
          order_id?: string | null
          paid_at?: string | null
          processed_at?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commission_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_documents: {
        Row: {
          created_at: string | null
          created_by: string | null
          document_type: string
          expiration_date: string | null
          file_size: number | null
          file_url: string | null
          id: string
          name: string
          status: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          document_type: string
          expiration_date?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          name: string
          status?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          document_type?: string
          expiration_date?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          name?: string
          status?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_manager_id: string | null
          address: string | null
          age_verified: boolean
          assigned_to: string | null
          auth_user_id: string | null
          business_license: string | null
          business_name: string | null
          city: string | null
          client_type: string | null
          company_name: string | null
          contact_type: string[]
          country: string
          created_at: string
          credit_limit: number
          email: string | null
          email_opt_in: boolean
          first_name: string | null
          id: string
          is_verified: boolean
          job_title: string | null
          last_contacted_at: string | null
          last_name: string | null
          last_order_at: string | null
          lead_source: string | null
          lead_status: string | null
          lifetime_value: number
          loyalty_points: number
          loyalty_tier: string | null
          metadata: Json | null
          name: string | null
          notes: string | null
          outstanding_balance: number
          payment_terms: string
          phone: string | null
          preferred_contact_method: string
          sms_opt_in: boolean
          state: string | null
          status: string
          tags: string[] | null
          tax_id: string | null
          tenant_id: string
          total_orders: number
          updated_at: string
          verified_at: string | null
          zip_code: string | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          age_verified?: boolean
          assigned_to?: string | null
          auth_user_id?: string | null
          business_license?: string | null
          business_name?: string | null
          city?: string | null
          client_type?: string | null
          company_name?: string | null
          contact_type?: string[]
          country?: string
          created_at?: string
          credit_limit?: number
          email?: string | null
          email_opt_in?: boolean
          first_name?: string | null
          id?: string
          is_verified?: boolean
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_order_at?: string | null
          lead_source?: string | null
          lead_status?: string | null
          lifetime_value?: number
          loyalty_points?: number
          loyalty_tier?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          outstanding_balance?: number
          payment_terms?: string
          phone?: string | null
          preferred_contact_method?: string
          sms_opt_in?: boolean
          state?: string | null
          status?: string
          tags?: string[] | null
          tax_id?: string | null
          tenant_id: string
          total_orders?: number
          updated_at?: string
          verified_at?: string | null
          zip_code?: string | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          age_verified?: boolean
          assigned_to?: string | null
          auth_user_id?: string | null
          business_license?: string | null
          business_name?: string | null
          city?: string | null
          client_type?: string | null
          company_name?: string | null
          contact_type?: string[]
          country?: string
          created_at?: string
          credit_limit?: number
          email?: string | null
          email_opt_in?: boolean
          first_name?: string | null
          id?: string
          is_verified?: boolean
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_order_at?: string | null
          lead_source?: string | null
          lead_status?: string | null
          lifetime_value?: number
          loyalty_points?: number
          loyalty_tier?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          outstanding_balance?: number
          payment_terms?: string
          phone?: string | null
          preferred_contact_method?: string
          sms_opt_in?: boolean
          state?: string | null
          status?: string
          tags?: string[] | null
          tax_id?: string | null
          tenant_id?: string
          total_orders?: number
          updated_at?: string
          verified_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          last_message_at: string | null
          order_id: string | null
          order_number: string | null
          status: string | null
          store_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          order_number?: string | null
          status?: string | null
          store_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          order_number?: string | null
          status?: string | null
          store_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "storefront_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_codes: {
        Row: {
          auto_apply: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          max_discount: number | null
          min_purchase: number | null
          never_expires: boolean | null
          per_user_limit: number | null
          start_date: string | null
          status: string | null
          total_usage_limit: number | null
          updated_at: string | null
          used_count: number | null
        }
        Insert: {
          auto_apply?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_date?: string | null
          id?: string
          max_discount?: number | null
          min_purchase?: number | null
          never_expires?: boolean | null
          per_user_limit?: number | null
          start_date?: string | null
          status?: string | null
          total_usage_limit?: number | null
          updated_at?: string | null
          used_count?: number | null
        }
        Update: {
          auto_apply?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          max_discount?: number | null
          min_purchase?: number | null
          never_expires?: boolean | null
          per_user_limit?: number | null
          start_date?: string | null
          status?: string | null
          total_usage_limit?: number | null
          updated_at?: string | null
          used_count?: number | null
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          coupon_id: string | null
          discount_amount: number
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          coupon_id?: string | null
          discount_amount: number
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          coupon_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_applications: {
        Row: {
          admin_notes: string | null
          borough: string
          created_at: string | null
          email: string
          experience: string
          full_name: string
          id: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          vehicle_type: string
        }
        Insert: {
          admin_notes?: string | null
          borough: string
          created_at?: string | null
          email: string
          experience: string
          full_name: string
          id?: string
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          vehicle_type: string
        }
        Update: {
          admin_notes?: string | null
          borough?: string
          created_at?: string | null
          email?: string
          experience?: string
          full_name?: string
          id?: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_bonuses: {
        Row: {
          amount: number
          bonus_type: string
          courier_id: string | null
          description: string | null
          earned_at: string | null
          id: string
        }
        Insert: {
          amount: number
          bonus_type: string
          courier_id?: string | null
          description?: string | null
          earned_at?: string | null
          id?: string
        }
        Update: {
          amount?: number
          bonus_type?: string
          courier_id?: string | null
          description?: string | null
          earned_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_bonuses_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_earnings: {
        Row: {
          base_pay: number | null
          bonus_amount: number | null
          commission_amount: number
          commission_rate: number
          courier_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          order_total: number
          paid_at: string | null
          payment_method: string | null
          status: string | null
          tip_amount: number | null
          total_earned: number
          week_start_date: string
        }
        Insert: {
          base_pay?: number | null
          bonus_amount?: number | null
          commission_amount: number
          commission_rate: number
          courier_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          order_total: number
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          tip_amount?: number | null
          total_earned: number
          week_start_date: string
        }
        Update: {
          base_pay?: number | null
          bonus_amount?: number | null
          commission_amount?: number
          commission_rate?: number
          courier_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          order_total?: number
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          tip_amount?: number | null
          total_earned?: number
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_earnings_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_courier_earnings_courier"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_courier_earnings_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_location_history: {
        Row: {
          accuracy: number | null
          courier_id: string | null
          heading: number | null
          id: string
          is_mock_location: boolean | null
          lat: number
          lng: number
          order_id: string | null
          speed: number | null
          timestamp: string | null
        }
        Insert: {
          accuracy?: number | null
          courier_id?: string | null
          heading?: number | null
          id?: string
          is_mock_location?: boolean | null
          lat: number
          lng: number
          order_id?: string | null
          speed?: number | null
          timestamp?: string | null
        }
        Update: {
          accuracy?: number | null
          courier_id?: string | null
          heading?: number | null
          id?: string
          is_mock_location?: boolean | null
          lat?: number
          lng?: number
          order_id?: string | null
          speed?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_location_history_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_location_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_messages: {
        Row: {
          courier_id: string | null
          created_at: string | null
          id: string
          message: string
          order_id: string | null
          read: boolean | null
          sender_type: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          order_id?: string | null
          read?: boolean | null
          sender_type: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string | null
          read?: boolean | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_messages_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_metrics: {
        Row: {
          avg_delivery_time_minutes: number | null
          avg_rating: number | null
          courier_id: string | null
          date: string
          deliveries_cancelled: number | null
          deliveries_completed: number | null
          id: string
          id_verification_failures: number | null
          late_deliveries: number | null
          total_distance_miles: number | null
          total_earnings: number | null
          total_ratings: number | null
        }
        Insert: {
          avg_delivery_time_minutes?: number | null
          avg_rating?: number | null
          courier_id?: string | null
          date: string
          deliveries_cancelled?: number | null
          deliveries_completed?: number | null
          id?: string
          id_verification_failures?: number | null
          late_deliveries?: number | null
          total_distance_miles?: number | null
          total_earnings?: number | null
          total_ratings?: number | null
        }
        Update: {
          avg_delivery_time_minutes?: number | null
          avg_rating?: number | null
          courier_id?: string | null
          date?: string
          deliveries_cancelled?: number | null
          deliveries_completed?: number | null
          id?: string
          id_verification_failures?: number | null
          late_deliveries?: number | null
          total_distance_miles?: number | null
          total_earnings?: number | null
          total_ratings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_metrics_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_pin_sessions: {
        Row: {
          courier_id: string
          created_at: string | null
          expires_at: string
          id: string
          session_token: string
        }
        Insert: {
          courier_id: string
          created_at?: string | null
          expires_at?: string
          id?: string
          session_token: string
        }
        Update: {
          courier_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_pin_sessions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_shifts: {
        Row: {
          courier_id: string | null
          ended_at: string | null
          id: string
          started_at: string
          status: string | null
          total_deliveries: number | null
          total_earnings: number | null
          total_hours: number | null
        }
        Insert: {
          courier_id?: string | null
          ended_at?: string | null
          id?: string
          started_at: string
          status?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          total_hours?: number | null
        }
        Update: {
          courier_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_shifts_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_streaks: {
        Row: {
          bonus_earned: number | null
          consecutive_deliveries: number | null
          courier_id: string | null
          id: string
          streak_date: string
        }
        Insert: {
          bonus_earned?: number | null
          consecutive_deliveries?: number | null
          courier_id?: string | null
          id?: string
          streak_date: string
        }
        Update: {
          bonus_earned?: number | null
          consecutive_deliveries?: number | null
          courier_id?: string | null
          id?: string
          streak_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_streaks_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          admin_pin: string | null
          admin_pin_verified: boolean | null
          age_verified: boolean | null
          commission_rate: number | null
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_location_update: string | null
          license_number: string
          notification_sound: boolean | null
          notification_vibrate: boolean | null
          on_time_rate: number | null
          phone: string
          pin_hash: string | null
          pin_last_verified_at: string | null
          pin_set_at: string | null
          profile_photo_url: string | null
          rating: number | null
          tenant_id: string | null
          total_deliveries: number | null
          updated_at: string | null
          user_id: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          admin_pin?: string | null
          admin_pin_verified?: boolean | null
          age_verified?: boolean | null
          commission_rate?: number | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_update?: string | null
          license_number: string
          notification_sound?: boolean | null
          notification_vibrate?: boolean | null
          on_time_rate?: number | null
          phone: string
          pin_hash?: string | null
          pin_last_verified_at?: string | null
          pin_set_at?: string | null
          profile_photo_url?: string | null
          rating?: number | null
          tenant_id?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type: string
        }
        Update: {
          admin_pin?: string | null
          admin_pin_verified?: boolean | null
          age_verified?: boolean | null
          commission_rate?: number | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_update?: string | null
          license_number?: string
          notification_sound?: boolean | null
          notification_vibrate?: boolean | null
          on_time_rate?: number | null
          phone?: string
          pin_hash?: string | null
          pin_last_verified_at?: string | null
          pin_set_at?: string | null
          profile_photo_url?: string | null
          rating?: number | null
          tenant_id?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "couriers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_analytics: {
        Row: {
          action_attempted: string | null
          created_at: string | null
          credits_at_event: number | null
          event_type: string
          id: string
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          action_attempted?: string | null
          created_at?: string | null
          credits_at_event?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          action_attempted?: string | null
          created_at?: string | null
          credits_at_event?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_costs: {
        Row: {
          action_key: string
          category: string | null
          created_at: string | null
          credit_cost: number
          description: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          action_key: string
          category?: string | null
          created_at?: string | null
          credit_cost: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          action_key?: string
          category?: string | null
          created_at?: string | null
          credit_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          bonus_credits: number | null
          created_at: string | null
          credits: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          slug: string | null
          sort_order: number | null
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          bonus_credits?: number | null
          created_at?: string | null
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
          slug?: string | null
          sort_order?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          bonus_credits?: number | null
          created_at?: string | null
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          slug?: string | null
          sort_order?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action_type: string | null
          amount: number
          balance_after: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          action_type?: string | null
          amount: number
          balance_after: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          transaction_type: string
        }
        Update: {
          action_type?: string | null
          amount?: number
          balance_after?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_log: {
        Row: {
          account_id: string
          activity_type: string
          client_id: string
          created_at: string | null
          description: string
          id: string
          performed_by_name: string | null
          performed_by_user_id: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          account_id: string
          activity_type: string
          client_id: string
          created_at?: string | null
          description: string
          id?: string
          performed_by_name?: string | null
          performed_by_user_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          account_id?: string
          activity_type?: string
          client_id?: string
          created_at?: string | null
          description?: string
          id?: string
          performed_by_name?: string | null
          performed_by_user_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          account_id: string
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notified_about_menu_update: boolean | null
          open_balance: number | null
          phone: string | null
          portal_last_login: string | null
          portal_password_hash: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notified_about_menu_update?: boolean | null
          open_balance?: number | null
          phone?: string | null
          portal_last_login?: string | null
          portal_password_hash?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notified_about_menu_update?: boolean | null
          open_balance?: number | null
          phone?: string | null
          portal_last_login?: string | null
          portal_password_hash?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invites: {
        Row: {
          accepted_at: string | null
          account_id: string
          client_id: string | null
          created_at: string | null
          email: string | null
          id: string
          invite_token: string
          name: string
          phone: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_token: string
          name: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_token?: string
          name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_invites_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoices: {
        Row: {
          account_id: string
          amount_paid: number | null
          client_id: string
          created_at: string | null
          created_from_pre_order_id: string | null
          credit_memo_id: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          is_recurring: boolean | null
          last_viewed_at: string | null
          line_items: Json | null
          overpayment_amount: number | null
          paid_at: string | null
          payment_history: Json | null
          public_token: string
          public_view_count: number | null
          recurring_schedule_id: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          template_id: string | null
          total: number
          updated_at: string | null
        }
        Insert: {
          account_id: string
          amount_paid?: number | null
          client_id: string
          created_at?: string | null
          created_from_pre_order_id?: string | null
          credit_memo_id?: string | null
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number: string
          is_recurring?: boolean | null
          last_viewed_at?: string | null
          line_items?: Json | null
          overpayment_amount?: number | null
          paid_at?: string | null
          payment_history?: Json | null
          public_token: string
          public_view_count?: number | null
          recurring_schedule_id?: string | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          tax_rate?: number | null
          template_id?: string | null
          total: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          amount_paid?: number | null
          client_id?: string
          created_at?: string | null
          created_from_pre_order_id?: string | null
          credit_memo_id?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_recurring?: boolean | null
          last_viewed_at?: string | null
          line_items?: Json | null
          overpayment_amount?: number | null
          paid_at?: string | null
          payment_history?: Json | null
          public_token?: string
          public_view_count?: number | null
          recurring_schedule_id?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          template_id?: string | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_created_from_pre_order_id_fkey"
            columns: ["created_from_pre_order_id"]
            isOneToOne: false
            referencedRelation: "crm_pre_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_recurring_schedule_id_fkey"
            columns: ["recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoice_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_messages: {
        Row: {
          account_id: string
          client_id: string
          created_at: string | null
          id: string
          message_text: string
          sender_name: string | null
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string | null
          id?: string
          message_text: string
          sender_name?: string | null
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string | null
          id?: string
          message_text?: string
          sender_name?: string | null
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          account_id: string
          client_id: string
          created_at: string | null
          created_by_name: string | null
          created_by_user_id: string | null
          id: string
          note_text: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string | null
          created_by_name?: string | null
          created_by_user_id?: string | null
          id?: string
          note_text: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string | null
          created_by_name?: string | null
          created_by_user_id?: string | null
          id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pre_orders: {
        Row: {
          account_id: string
          client_id: string
          converted_at: string | null
          converted_to_invoice_id: string | null
          created_at: string | null
          id: string
          line_items: Json | null
          pre_order_number: string
          status: string | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string | null
          id?: string
          line_items?: Json | null
          pre_order_number: string
          status?: string | null
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string | null
          id?: string
          line_items?: Json | null
          pre_order_number?: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_pre_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pre_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pre_orders_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_settings: {
        Row: {
          account_id: string
          created_at: string | null
          faqs: Json | null
          id: string
          menu_last_updated_at: string | null
          returns_refunds_count: number | null
          subscription_info: string | null
          telegram_video_link: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          faqs?: Json | null
          id?: string
          menu_last_updated_at?: string | null
          returns_refunds_count?: number | null
          subscription_info?: string | null
          telegram_video_link?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          faqs?: Json | null
          id?: string
          menu_last_updated_at?: string | null
          returns_refunds_count?: number | null
          subscription_info?: string | null
          telegram_video_link?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          name: string
          status: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_reports: {
        Row: {
          created_at: string | null
          created_by: string
          custom_end_date: string | null
          custom_start_date: string | null
          date_range: string | null
          description: string | null
          email_recipients: string[] | null
          filters: Json | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          report_type: string
          schedule: string | null
          schedule_day_of_month: number | null
          schedule_day_of_week: number | null
          schedule_time: string | null
          selected_fields: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          date_range?: string | null
          description?: string | null
          email_recipients?: string[] | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          report_type: string
          schedule?: string | null
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_time?: string | null
          selected_fields?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          date_range?: string | null
          description?: string | null
          email_recipients?: string[] | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          report_type?: string
          schedule?: string | null
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_time?: string | null
          selected_fields?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_balances: {
        Row: {
          account_id: string
          customer_id: string
          id: string
          last_purchase_at: string | null
          lifetime_spend: number | null
          outstanding_balance: number | null
          prepaid_balance: number | null
          store_credit: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          customer_id: string
          id?: string
          last_purchase_at?: string | null
          lifetime_spend?: number | null
          outstanding_balance?: number | null
          prepaid_balance?: number | null
          store_credit?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          customer_id?: string
          id?: string
          last_purchase_at?: string | null
          lifetime_spend?: number | null
          outstanding_balance?: number | null
          prepaid_balance?: number | null
          store_credit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communications: {
        Row: {
          body: string | null
          communication_type: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          metadata: Json | null
          sent_at: string | null
          status: string | null
          subject: string | null
          tenant_id: string
        }
        Insert: {
          body?: string | null
          communication_type: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id: string
        }
        Update: {
          body?: string | null
          communication_type?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_balance: {
        Row: {
          balance: number
          customer_id: string
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          customer_id: string
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          customer_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_balance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          order_id: string | null
          reason: string | null
          tenant_id: string
          transaction_type: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          order_id?: string | null
          reason?: string | null
          tenant_id: string
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          order_id?: string | null
          reason?: string | null
          tenant_id?: string
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          account_id: string
          created_at: string | null
          customer_id: string
          discount: number | null
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: string | null
          subtotal: number
          tax: number | null
          total: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          customer_id: string
          discount?: number | null
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          subtotal: number
          tax?: number | null
          total: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          customer_id?: string
          discount?: number | null
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty_points: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          points: number | null
          tenant_id: string
          tier_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          points?: number | null
          tenant_id: string
          tier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          points?: number | null
          tenant_id?: string
          tier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_points_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_points_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          account_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          is_internal: boolean | null
          note: string
          note_type: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          is_internal?: boolean | null
          note: string
          note_type?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          is_internal?: boolean | null
          note?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          customer_id: string
          external_payment_reference: string | null
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string
          payment_status: string | null
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          customer_id: string
          external_payment_reference?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method: string
          payment_status?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          customer_id?: string
          external_payment_reference?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          payment_status?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referrals: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          referral_status: string | null
          referred_customer_id: string
          referred_reward_value: string | null
          referrer_customer_id: string
          referrer_reward_points: number | null
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          referral_status?: string | null
          referred_customer_id: string
          referred_reward_value?: string | null
          referrer_customer_id: string
          referrer_reward_points?: number | null
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          referral_status?: string | null
          referred_customer_id?: string
          referred_reward_value?: string | null
          referrer_customer_id?: string
          referrer_reward_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_referrals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referrals_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_users: {
        Row: {
          business_license_number: string | null
          business_name: string | null
          clerk_user_id: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          email_verification_sent_at: string | null
          email_verification_token: string | null
          email_verified: boolean | null
          first_name: string | null
          id: string
          is_active: boolean | null
          is_business_buyer: boolean | null
          last_login_at: string | null
          last_name: string | null
          password_hash: string
          phone: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          business_license_number?: string | null
          business_name?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          email_verification_sent_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          is_business_buyer?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          password_hash: string
          phone?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          business_license_number?: string | null
          business_name?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          email_verification_sent_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          is_business_buyer?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          password_hash?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_id: string
          address: string | null
          address_encrypted: string | null
          allergies: string[] | null
          allergies_encrypted: string | null
          balance: number | null
          business_name: string | null
          caregiver_name: string | null
          caregiver_name_encrypted: string | null
          caregiver_phone: string | null
          caregiver_phone_encrypted: string | null
          cbd_preference: string | null
          city: string | null
          city_encrypted: string | null
          created_at: string | null
          customer_type: string | null
          date_of_birth: string | null
          date_of_birth_encrypted: string | null
          deleted_at: string | null
          email: string | null
          email_encrypted: string | null
          email_opt_in: boolean | null
          email_search_index: string | null
          encryption_metadata: Json | null
          first_name: string
          first_name_encrypted: string | null
          flavor_preferences: string[] | null
          id: string
          is_encrypted: boolean | null
          is_tax_exempt: boolean | null
          last_name: string
          last_name_encrypted: string | null
          last_purchase_at: string | null
          loyalty_points: number | null
          loyalty_tier: string | null
          marketing_opt_in: boolean | null
          medical_card_expiration: string | null
          medical_card_expiration_encrypted: string | null
          medical_card_number: string | null
          medical_card_number_encrypted: string | null
          medical_card_number_search_index: string | null
          medical_card_photo_url: string | null
          medical_card_photo_url_encrypted: string | null
          medical_card_state: string | null
          medical_card_state_encrypted: string | null
          monthly_allotment_limit: number | null
          phone: string | null
          phone_encrypted: string | null
          phone_search_index: string | null
          physician_name: string | null
          physician_name_encrypted: string | null
          preferred_consumption_method: string[] | null
          preferred_products: string[] | null
          preferred_products_encrypted: string | null
          preferred_strains: string[] | null
          preferred_strains_encrypted: string | null
          qualifying_conditions: string[] | null
          qualifying_conditions_encrypted: string | null
          referral_source: string | null
          sms_opt_in: boolean | null
          state: string | null
          state_encrypted: string | null
          status: string | null
          tax_exempt_certificate: string | null
          tenant_id: string | null
          thc_preference: string | null
          total_spent: number | null
          updated_at: string | null
          version: number | null
          zip_code: string | null
          zip_code_encrypted: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          address_encrypted?: string | null
          allergies?: string[] | null
          allergies_encrypted?: string | null
          balance?: number | null
          business_name?: string | null
          caregiver_name?: string | null
          caregiver_name_encrypted?: string | null
          caregiver_phone?: string | null
          caregiver_phone_encrypted?: string | null
          cbd_preference?: string | null
          city?: string | null
          city_encrypted?: string | null
          created_at?: string | null
          customer_type?: string | null
          date_of_birth?: string | null
          date_of_birth_encrypted?: string | null
          deleted_at?: string | null
          email?: string | null
          email_encrypted?: string | null
          email_opt_in?: boolean | null
          email_search_index?: string | null
          encryption_metadata?: Json | null
          first_name: string
          first_name_encrypted?: string | null
          flavor_preferences?: string[] | null
          id?: string
          is_encrypted?: boolean | null
          is_tax_exempt?: boolean | null
          last_name: string
          last_name_encrypted?: string | null
          last_purchase_at?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          marketing_opt_in?: boolean | null
          medical_card_expiration?: string | null
          medical_card_expiration_encrypted?: string | null
          medical_card_number?: string | null
          medical_card_number_encrypted?: string | null
          medical_card_number_search_index?: string | null
          medical_card_photo_url?: string | null
          medical_card_photo_url_encrypted?: string | null
          medical_card_state?: string | null
          medical_card_state_encrypted?: string | null
          monthly_allotment_limit?: number | null
          phone?: string | null
          phone_encrypted?: string | null
          phone_search_index?: string | null
          physician_name?: string | null
          physician_name_encrypted?: string | null
          preferred_consumption_method?: string[] | null
          preferred_products?: string[] | null
          preferred_products_encrypted?: string | null
          preferred_strains?: string[] | null
          preferred_strains_encrypted?: string | null
          qualifying_conditions?: string[] | null
          qualifying_conditions_encrypted?: string | null
          referral_source?: string | null
          sms_opt_in?: boolean | null
          state?: string | null
          state_encrypted?: string | null
          status?: string | null
          tax_exempt_certificate?: string | null
          tenant_id?: string | null
          thc_preference?: string | null
          total_spent?: number | null
          updated_at?: string | null
          version?: number | null
          zip_code?: string | null
          zip_code_encrypted?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          address_encrypted?: string | null
          allergies?: string[] | null
          allergies_encrypted?: string | null
          balance?: number | null
          business_name?: string | null
          caregiver_name?: string | null
          caregiver_name_encrypted?: string | null
          caregiver_phone?: string | null
          caregiver_phone_encrypted?: string | null
          cbd_preference?: string | null
          city?: string | null
          city_encrypted?: string | null
          created_at?: string | null
          customer_type?: string | null
          date_of_birth?: string | null
          date_of_birth_encrypted?: string | null
          deleted_at?: string | null
          email?: string | null
          email_encrypted?: string | null
          email_opt_in?: boolean | null
          email_search_index?: string | null
          encryption_metadata?: Json | null
          first_name?: string
          first_name_encrypted?: string | null
          flavor_preferences?: string[] | null
          id?: string
          is_encrypted?: boolean | null
          is_tax_exempt?: boolean | null
          last_name?: string
          last_name_encrypted?: string | null
          last_purchase_at?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          marketing_opt_in?: boolean | null
          medical_card_expiration?: string | null
          medical_card_expiration_encrypted?: string | null
          medical_card_number?: string | null
          medical_card_number_encrypted?: string | null
          medical_card_number_search_index?: string | null
          medical_card_photo_url?: string | null
          medical_card_photo_url_encrypted?: string | null
          medical_card_state?: string | null
          medical_card_state_encrypted?: string | null
          monthly_allotment_limit?: number | null
          phone?: string | null
          phone_encrypted?: string | null
          phone_search_index?: string | null
          physician_name?: string | null
          physician_name_encrypted?: string | null
          preferred_consumption_method?: string[] | null
          preferred_products?: string[] | null
          preferred_products_encrypted?: string | null
          preferred_strains?: string[] | null
          preferred_strains_encrypted?: string | null
          qualifying_conditions?: string[] | null
          qualifying_conditions_encrypted?: string | null
          referral_source?: string | null
          sms_opt_in?: boolean | null
          state?: string | null
          state_encrypted?: string | null
          status?: string | null
          tax_exempt_certificate?: string | null
          tenant_id?: string | null
          thc_preference?: string | null
          total_spent?: number | null
          updated_at?: string | null
          version?: number | null
          zip_code?: string | null
          zip_code_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          actual_dropoff_time: string | null
          actual_pickup_time: string | null
          courier_id: string
          created_at: string | null
          delivery_notes: string | null
          delivery_photo_url: string | null
          dropoff_lat: number
          dropoff_lng: number
          estimated_dropoff_time: string | null
          estimated_pickup_time: string | null
          id: string
          id_verification_url: string | null
          manifest_url: string | null
          order_id: string
          pickup_lat: number
          pickup_lng: number
          pickup_photo_url: string | null
          signature_url: string | null
          tenant_id: string | null
        }
        Insert: {
          actual_dropoff_time?: string | null
          actual_pickup_time?: string | null
          courier_id: string
          created_at?: string | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          dropoff_lat: number
          dropoff_lng: number
          estimated_dropoff_time?: string | null
          estimated_pickup_time?: string | null
          id?: string
          id_verification_url?: string | null
          manifest_url?: string | null
          order_id: string
          pickup_lat: number
          pickup_lng: number
          pickup_photo_url?: string | null
          signature_url?: string | null
          tenant_id?: string | null
        }
        Update: {
          actual_dropoff_time?: string | null
          actual_pickup_time?: string | null
          courier_id?: string
          created_at?: string | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          dropoff_lat?: number
          dropoff_lng?: number
          estimated_dropoff_time?: string | null
          estimated_pickup_time?: string | null
          id?: string
          id_verification_url?: string | null
          manifest_url?: string | null
          order_id?: string
          pickup_lat?: number
          pickup_lng?: number
          pickup_photo_url?: string | null
          signature_url?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fingerprints: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          browser: string | null
          created_at: string | null
          device_type: string | null
          fingerprint: string
          id: string
          ip_address: string | null
          is_blocked: boolean | null
          last_seen: string | null
          multiple_accounts: boolean | null
          os: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          fingerprint: string
          id?: string
          ip_address?: string | null
          is_blocked?: boolean | null
          last_seen?: string | null
          multiple_accounts?: boolean | null
          os?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          fingerprint?: string
          id?: string
          ip_address?: string | null
          is_blocked?: boolean | null
          last_seen?: string | null
          multiple_accounts?: boolean | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      disposable_menu_products: {
        Row: {
          created_at: string
          custom_price: number | null
          display_availability: boolean
          display_order: number
          encrypted_custom_price: string | null
          id: string
          is_encrypted: boolean
          menu_id: string
          prices: Json | null
          product_id: string
        }
        Insert: {
          created_at?: string
          custom_price?: number | null
          display_availability?: boolean
          display_order?: number
          encrypted_custom_price?: string | null
          id?: string
          is_encrypted?: boolean
          menu_id: string
          prices?: Json | null
          product_id: string
        }
        Update: {
          created_at?: string
          custom_price?: number | null
          display_availability?: boolean
          display_order?: number
          encrypted_custom_price?: string | null
          id?: string
          is_encrypted?: boolean
          menu_id?: string
          prices?: Json | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposable_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposable_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposable_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "disposable_menu_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "wholesale_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_menus: {
        Row: {
          access_code: string | null
          access_code_hash: string
          access_code_rotation_days: number | null
          access_type: string | null
          appearance_settings: Json
          appearance_style: string | null
          auto_burn_hours: number | null
          burn_reason: string | null
          burned_at: string | null
          business_name: string | null
          created_at: string
          created_by: string | null
          custom_message: string | null
          description: string | null
          device_locking_enabled: boolean | null
          encrypted_appearance_settings: string | null
          encrypted_description: string | null
          encrypted_max_order_quantity: string | null
          encrypted_min_order_quantity: string | null
          encrypted_name: string | null
          encrypted_security_settings: string | null
          encrypted_url_token: string
          encryption_version: number
          expiration_date: string | null
          id: string
          is_encrypted: boolean
          max_order_quantity: number | null
          min_order_quantity: number | null
          name: string
          never_expires: boolean
          notification_settings: Json | null
          screenshot_protection_enabled: boolean | null
          screenshot_watermark_enabled: boolean | null
          security_settings: Json
          show_availability: boolean | null
          show_contact_info: boolean | null
          show_minimum_order: boolean | null
          show_product_images: boolean | null
          status: Database["public"]["Enums"]["menu_status"]
          tenant_id: string
          title: string | null
          view_limit_per_customer: number | null
          view_limit_period: string | null
        }
        Insert: {
          access_code?: string | null
          access_code_hash: string
          access_code_rotation_days?: number | null
          access_type?: string | null
          appearance_settings?: Json
          appearance_style?: string | null
          auto_burn_hours?: number | null
          burn_reason?: string | null
          burned_at?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_message?: string | null
          description?: string | null
          device_locking_enabled?: boolean | null
          encrypted_appearance_settings?: string | null
          encrypted_description?: string | null
          encrypted_max_order_quantity?: string | null
          encrypted_min_order_quantity?: string | null
          encrypted_name?: string | null
          encrypted_security_settings?: string | null
          encrypted_url_token: string
          encryption_version?: number
          expiration_date?: string | null
          id?: string
          is_encrypted?: boolean
          max_order_quantity?: number | null
          min_order_quantity?: number | null
          name: string
          never_expires?: boolean
          notification_settings?: Json | null
          screenshot_protection_enabled?: boolean | null
          screenshot_watermark_enabled?: boolean | null
          security_settings?: Json
          show_availability?: boolean | null
          show_contact_info?: boolean | null
          show_minimum_order?: boolean | null
          show_product_images?: boolean | null
          status?: Database["public"]["Enums"]["menu_status"]
          tenant_id: string
          title?: string | null
          view_limit_per_customer?: number | null
          view_limit_period?: string | null
        }
        Update: {
          access_code?: string | null
          access_code_hash?: string
          access_code_rotation_days?: number | null
          access_type?: string | null
          appearance_settings?: Json
          appearance_style?: string | null
          auto_burn_hours?: number | null
          burn_reason?: string | null
          burned_at?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_message?: string | null
          description?: string | null
          device_locking_enabled?: boolean | null
          encrypted_appearance_settings?: string | null
          encrypted_description?: string | null
          encrypted_max_order_quantity?: string | null
          encrypted_min_order_quantity?: string | null
          encrypted_name?: string | null
          encrypted_security_settings?: string | null
          encrypted_url_token?: string
          encryption_version?: number
          expiration_date?: string | null
          id?: string
          is_encrypted?: boolean
          max_order_quantity?: number | null
          min_order_quantity?: number | null
          name?: string
          never_expires?: boolean
          notification_settings?: Json | null
          screenshot_protection_enabled?: boolean | null
          screenshot_watermark_enabled?: boolean | null
          security_settings?: Json
          show_availability?: boolean | null
          show_contact_info?: boolean | null
          show_minimum_order?: boolean | null
          show_product_images?: boolean | null
          status?: Database["public"]["Enums"]["menu_status"]
          tenant_id?: string
          title?: string | null
          view_limit_per_customer?: number | null
          view_limit_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_disposable_menus_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_audit_log: {
        Row: {
          action: string
          created_at: string | null
          document_id: string
          id: string
          performed_by: string | null
          performed_by_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          document_id: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          document_id?: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "compliance_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          metadata: Json | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          page_url: string | null
          resolved: boolean | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          page_url?: string | null
          resolved?: boolean | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          page_url?: string | null
          resolved?: boolean | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          id: string
          notes: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          notes?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_emails: {
        Row: {
          created_at: string
          email_data: Json
          error_message: string | null
          id: string
          max_retries: number
          next_retry: string
          recipient: string
          retry_count: number
          template: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_data?: Json
          error_message?: string | null
          id?: string
          max_retries?: number
          next_retry?: string
          recipient: string
          retry_count?: number
          template: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_data?: Json
          error_message?: string | null
          id?: string
          max_retries?: number
          next_retry?: string
          recipient?: string
          retry_count?: number
          template?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          flag_name: string
          id: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          flag_name: string
          id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          flag_name?: string
          id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage_tracking: {
        Row: {
          created_at: string | null
          feature_id: string
          id: string
          last_used_at: string | null
          tenant_id: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_id: string
          id?: string
          last_used_at?: string | null
          tenant_id: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_id?: string
          id?: string
          last_used_at?: string | null
          tenant_id?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_usage_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          member_count: number
          name: string
          post_count: number
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          member_count?: number
          name: string
          post_count?: number
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          member_count?: number
          name?: string
          post_count?: number
          slug?: string
        }
        Relationships: []
      }
      forum_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          depth: number
          downvote_count: number
          id: string
          is_removed: boolean
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          upvote_count: number
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          depth?: number
          downvote_count?: number
          id?: string
          is_removed?: boolean
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          depth?: number
          downvote_count?: number
          id?: string
          is_removed?: boolean
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          upvote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "forum_user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_notifications: {
        Row: {
          action_url: string | null
          actor_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          message: string | null
          post_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "forum_user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          author_id: string | null
          category_id: string | null
          comment_count: number
          content: string | null
          content_type: string
          created_at: string
          downvote_count: number
          id: string
          images: string[] | null
          is_pinned: boolean
          is_removed: boolean
          link_url: string | null
          linked_listing_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          upvote_count: number
          view_count: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          comment_count?: number
          content?: string | null
          content_type?: string
          created_at?: string
          downvote_count?: number
          id?: string
          images?: string[] | null
          is_pinned?: boolean
          is_removed?: boolean
          link_url?: string | null
          linked_listing_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          upvote_count?: number
          view_count?: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          comment_count?: number
          content?: string | null
          content_type?: string
          created_at?: string
          downvote_count?: number
          id?: string
          images?: string[] | null
          is_pinned?: boolean
          is_removed?: boolean
          link_url?: string | null
          linked_listing_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          upvote_count?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "forum_user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_user_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_approved: boolean
          created_at: string
          customer_user_id: string
          id: string
          rejection_reason: string | null
          request_message: string | null
          requested_at: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_approved?: boolean
          created_at?: string
          customer_user_id: string
          id?: string
          rejection_reason?: string | null
          request_message?: string | null
          requested_at?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_approved?: boolean
          created_at?: string
          customer_user_id?: string
          id?: string
          rejection_reason?: string | null
          request_message?: string | null
          requested_at?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_user_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          customer_user_id: string
          display_name: string | null
          id: string
          status: string
          tenant_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          customer_user_id: string
          display_name?: string | null
          id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          customer_user_id?: string
          display_name?: string | null
          id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_votes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          votable_id: string
          votable_type: string
          vote: number
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          votable_id: string
          votable_type: string
          vote: number
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          votable_id?: string
          votable_type?: string
          vote?: number
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          auto_resolved: boolean | null
          created_at: string | null
          description: string
          flag_type: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          auto_resolved?: boolean | null
          created_at?: string | null
          description: string
          flag_type: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          auto_resolved?: boolean | null
          created_at?: string | null
          description?: string
          flag_type?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fronted_inventory: {
        Row: {
          account_id: string
          batch_number: string | null
          completed_at: string | null
          completed_by: string | null
          cost_per_unit: number
          created_at: string | null
          deal_type: string
          dispatched_at: string | null
          dispatched_by: string | null
          expected_profit: number | null
          expected_revenue: number | null
          fronted_to_customer_name: string | null
          fronted_to_location_id: string | null
          fronted_to_user_id: string | null
          id: string
          notes: string | null
          payment_due_date: string | null
          payment_received: number | null
          payment_status: string | null
          price_per_unit: number
          product_id: string
          quantity_damaged: number | null
          quantity_fronted: number
          quantity_returned: number | null
          quantity_sold: number | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          batch_number?: string | null
          completed_at?: string | null
          completed_by?: string | null
          cost_per_unit: number
          created_at?: string | null
          deal_type: string
          dispatched_at?: string | null
          dispatched_by?: string | null
          expected_profit?: number | null
          expected_revenue?: number | null
          fronted_to_customer_name?: string | null
          fronted_to_location_id?: string | null
          fronted_to_user_id?: string | null
          id?: string
          notes?: string | null
          payment_due_date?: string | null
          payment_received?: number | null
          payment_status?: string | null
          price_per_unit: number
          product_id: string
          quantity_damaged?: number | null
          quantity_fronted: number
          quantity_returned?: number | null
          quantity_sold?: number | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          batch_number?: string | null
          completed_at?: string | null
          completed_by?: string | null
          cost_per_unit?: number
          created_at?: string | null
          deal_type?: string
          dispatched_at?: string | null
          dispatched_by?: string | null
          expected_profit?: number | null
          expected_revenue?: number | null
          fronted_to_customer_name?: string | null
          fronted_to_location_id?: string | null
          fronted_to_user_id?: string | null
          id?: string
          notes?: string | null
          payment_due_date?: string | null
          payment_received?: number | null
          payment_status?: string | null
          price_per_unit?: number
          product_id?: string
          quantity_damaged?: number | null
          quantity_fronted?: number
          quantity_returned?: number | null
          quantity_sold?: number | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fronted_inventory_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_inventory_fronted_to_location_id_fkey"
            columns: ["fronted_to_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fronted_inventory_scans: {
        Row: {
          account_id: string
          barcode: string | null
          fronted_inventory_id: string | null
          id: string
          latitude: number | null
          location_id: string | null
          longitude: number | null
          notes: string | null
          product_id: string | null
          quantity: number
          scan_type: string
          scanned_at: string | null
          scanned_by: string | null
        }
        Insert: {
          account_id: string
          barcode?: string | null
          fronted_inventory_id?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          product_id?: string | null
          quantity: number
          scan_type: string
          scanned_at?: string | null
          scanned_by?: string | null
        }
        Update: {
          account_id?: string
          barcode?: string | null
          fronted_inventory_id?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          scan_type?: string
          scanned_at?: string | null
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fronted_inventory_scans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_inventory_scans_fronted_inventory_id_fkey"
            columns: ["fronted_inventory_id"]
            isOneToOne: false
            referencedRelation: "fronted_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_inventory_scans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_inventory_scans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      fronted_payments: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          fronted_inventory_id: string | null
          id: string
          notes: string | null
          paid_by_name: string | null
          paid_by_user_id: string | null
          payment_method: string
          payment_reference: string | null
          received_at: string | null
          received_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          fronted_inventory_id?: string | null
          id?: string
          notes?: string | null
          paid_by_name?: string | null
          paid_by_user_id?: string | null
          payment_method: string
          payment_reference?: string | null
          received_at?: string | null
          received_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          fronted_inventory_id?: string | null
          id?: string
          notes?: string | null
          paid_by_name?: string | null
          paid_by_user_id?: string | null
          payment_method?: string
          payment_reference?: string | null
          received_at?: string | null
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fronted_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fronted_payments_fronted_inventory_id_fkey"
            columns: ["fronted_inventory_id"]
            isOneToOne: false
            referencedRelation: "fronted_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_checks: {
        Row: {
          action_allowed: boolean
          action_attempted: string | null
          check_timestamp: string | null
          created_at: string | null
          customer_lat: number
          customer_lng: number
          distance_miles: number
          driver_id: string | null
          driver_lat: number
          driver_lng: number
          id: string
          order_id: string | null
          override_approved: boolean | null
          override_reason: string | null
          override_requested: boolean | null
          within_geofence: boolean
        }
        Insert: {
          action_allowed: boolean
          action_attempted?: string | null
          check_timestamp?: string | null
          created_at?: string | null
          customer_lat: number
          customer_lng: number
          distance_miles: number
          driver_id?: string | null
          driver_lat: number
          driver_lng: number
          id?: string
          order_id?: string | null
          override_approved?: boolean | null
          override_reason?: string | null
          override_requested?: boolean | null
          within_geofence: boolean
        }
        Update: {
          action_allowed?: boolean
          action_attempted?: string | null
          check_timestamp?: string | null
          created_at?: string | null
          customer_lat?: number
          customer_lng?: number
          distance_miles?: number
          driver_id?: string | null
          driver_lat?: number
          driver_lng?: number
          id?: string
          order_id?: string | null
          override_approved?: boolean | null
          override_reason?: string | null
          override_requested?: boolean | null
          within_geofence?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "geofence_checks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_referrals: {
        Row: {
          clicked_at: string | null
          converted: boolean | null
          created_at: string | null
          entries_awarded: number | null
          giveaway_id: string | null
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string | null
          signed_up_at: string | null
        }
        Insert: {
          clicked_at?: string | null
          converted?: boolean | null
          created_at?: string | null
          entries_awarded?: number | null
          giveaway_id?: string | null
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id?: string | null
          signed_up_at?: string | null
        }
        Update: {
          clicked_at?: string | null
          converted?: boolean | null
          created_at?: string | null
          entries_awarded?: number | null
          giveaway_id?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string | null
          signed_up_at?: string | null
        }
        Relationships: []
      }
      giveaway_winners: {
        Row: {
          claimed_at: string | null
          credit_amount: number | null
          credit_code: string | null
          entry_id: string | null
          giveaway_id: string | null
          id: string
          notified_at: string | null
          prize_rank: number
          prize_title: string | null
          prize_value: number | null
          selected_at: string | null
          status: string | null
          user_id: string | null
          winning_entry_number: number | null
        }
        Insert: {
          claimed_at?: string | null
          credit_amount?: number | null
          credit_code?: string | null
          entry_id?: string | null
          giveaway_id?: string | null
          id?: string
          notified_at?: string | null
          prize_rank: number
          prize_title?: string | null
          prize_value?: number | null
          selected_at?: string | null
          status?: string | null
          user_id?: string | null
          winning_entry_number?: number | null
        }
        Update: {
          claimed_at?: string | null
          credit_amount?: number | null
          credit_code?: string | null
          entry_id?: string | null
          giveaway_id?: string | null
          id?: string
          notified_at?: string | null
          prize_rank?: number
          prize_title?: string | null
          prize_value?: number | null
          selected_at?: string | null
          status?: string | null
          user_id?: string | null
          winning_entry_number?: number | null
        }
        Relationships: []
      }
      global_product_imports: {
        Row: {
          auto_sync_enabled: boolean | null
          global_product_id: string
          id: string
          imported_at: string | null
          last_synced_at: string | null
          listing_id: string | null
          tenant_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean | null
          global_product_id: string
          id?: string
          imported_at?: string | null
          last_synced_at?: string | null
          listing_id?: string | null
          tenant_id: string
        }
        Update: {
          auto_sync_enabled?: boolean | null
          global_product_id?: string
          id?: string
          imported_at?: string | null
          last_synced_at?: string | null
          listing_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_product_imports_global_product_id_fkey"
            columns: ["global_product_id"]
            isOneToOne: false
            referencedRelation: "global_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_product_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      global_products: {
        Row: {
          brand: string | null
          category: string
          cbd_percent: number | null
          created_at: string | null
          description: string | null
          effects: string[] | null
          id: string
          images: string[] | null
          is_verified: boolean | null
          metadata: Json | null
          name: string
          short_description: string | null
          sku: string
          status: string
          strain_type: string | null
          submission_notes: string | null
          submitted_by_tenant_id: string | null
          terpenes: Json | null
          thc_percent: number | null
          unit_type: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          weight_grams: number | null
        }
        Insert: {
          brand?: string | null
          category: string
          cbd_percent?: number | null
          created_at?: string | null
          description?: string | null
          effects?: string[] | null
          id?: string
          images?: string[] | null
          is_verified?: boolean | null
          metadata?: Json | null
          name: string
          short_description?: string | null
          sku: string
          status?: string
          strain_type?: string | null
          submission_notes?: string | null
          submitted_by_tenant_id?: string | null
          terpenes?: Json | null
          thc_percent?: number | null
          unit_type?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          weight_grams?: number | null
        }
        Update: {
          brand?: string | null
          category?: string
          cbd_percent?: number | null
          created_at?: string | null
          description?: string | null
          effects?: string[] | null
          id?: string
          images?: string[] | null
          is_verified?: boolean | null
          metadata?: Json | null
          name?: string
          short_description?: string | null
          sku?: string
          status?: string
          strain_type?: string | null
          submission_notes?: string | null
          submitted_by_tenant_id?: string | null
          terpenes?: Json | null
          thc_percent?: number | null
          unit_type?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "global_products_submitted_by_tenant_id_fkey"
            columns: ["submitted_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_anomalies: {
        Row: {
          accuracy_meters: number | null
          admin_notified: boolean | null
          anomaly_type: string
          courier_id: string
          detected_at: string | null
          id: string
          lat: number | null
          lng: number | null
          order_id: string | null
          resolved: boolean | null
          speed_mph: number | null
        }
        Insert: {
          accuracy_meters?: number | null
          admin_notified?: boolean | null
          anomaly_type: string
          courier_id: string
          detected_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          order_id?: string | null
          resolved?: boolean | null
          speed_mph?: number | null
        }
        Update: {
          accuracy_meters?: number | null
          admin_notified?: boolean | null
          anomaly_type?: string
          courier_id?: string
          detected_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          order_id?: string | null
          resolved?: boolean | null
          speed_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_anomalies_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_anomalies_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          merchant_id: string
          product_id: string
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          merchant_id: string
          product_id: string
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          merchant_id?: string
          product_id?: string
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          account_id: string
          adjusted_by: string | null
          adjustment_type: string
          created_at: string | null
          id: string
          location_id: string | null
          product_id: string
          quantity_change: number
          reason: string | null
          reference_id: string | null
        }
        Insert: {
          account_id: string
          adjusted_by?: string | null
          adjustment_type: string
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_id: string
          quantity_change: number
          reason?: string | null
          reference_id?: string | null
        }
        Update: {
          account_id?: string
          adjusted_by?: string | null
          adjustment_type?: string
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_id?: string
          quantity_change?: number
          reason?: string | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          current_quantity: number
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          is_resolved: boolean | null
          message: string
          product_id: string | null
          product_name: string
          reorder_point: number | null
          resolved_at: string | null
          severity: string
          snooze_count: number | null
          snoozed_until: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          current_quantity: number
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          product_id?: string | null
          product_name: string
          reorder_point?: number | null
          resolved_at?: string | null
          severity: string
          snooze_count?: number | null
          snoozed_until?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          current_quantity?: number
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          product_id?: string | null
          product_name?: string
          reorder_point?: number | null
          resolved_at?: string | null
          severity?: string
          snooze_count?: number | null
          snoozed_until?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "wholesale_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          account_id: string | null
          batch_number: string
          cost_per_lb: number | null
          created_at: string | null
          expiration_date: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity_lbs: number | null
          received_date: string | null
          status: string | null
          supplier_id: string | null
          updated_at: string | null
          warehouse_location: string | null
        }
        Insert: {
          account_id?: string | null
          batch_number: string
          cost_per_lb?: number | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity_lbs?: number | null
          received_date?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          warehouse_location?: string | null
        }
        Update: {
          account_id?: string | null
          batch_number?: string
          cost_per_lb?: number | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity_lbs?: number | null
          received_date?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          account_id: string
          address: string | null
          assigned_to_user_id: string | null
          city: string | null
          created_at: string | null
          id: string
          location_name: string
          location_type: string
          state: string | null
          status: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          assigned_to_user_id?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          location_name: string
          location_type: string
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          assigned_to_user_id?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          location_name?: string
          location_type?: string
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          account_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          from_location_id: string
          id: string
          initiated_by: string | null
          notes: string | null
          product_id: string
          quantity: number
          status: string | null
          tenant_id: string | null
          to_location_id: string
          transfer_number: string
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          from_location_id: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          product_id: string
          quantity: number
          status?: string | null
          tenant_id?: string | null
          to_location_id: string
          transfer_number: string
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          from_location_id?: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string | null
          tenant_id?: string | null
          to_location_id?: string
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email: string | null
          expires_at: string | null
          id: string
          menu_id: string | null
          message: string | null
          method: string
          phone: string | null
          status: string | null
          unique_link: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          menu_id?: string | null
          message?: string | null
          method: string
          phone?: string | null
          status?: string | null
          unique_link?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          menu_id?: string | null
          message?: string | null
          method?: string
          phone?: string | null
          status?: string | null
          unique_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          is_system: boolean | null
          name: string
          template_data: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name: string
          template_data?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name?: string
          template_data?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          billing_period_end: string | null
          billing_period_start: string | null
          client_id: string | null
          created_at: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          line_items: Json | null
          paid_at: string | null
          status: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax: number | null
          tenant_id: string
          total: number
          updated_at: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          client_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          line_items?: Json | null
          paid_at?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal: number
          tax?: number | null
          tenant_id: string
          total: number
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          client_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          line_items?: Json | null
          paid_at?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number | null
          tenant_id?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      label_templates: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          label_type: string
          name: string
          state: string | null
          template_config: Json | null
          template_html: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label_type: string
          name: string
          state?: string | null
          template_config?: Json | null
          template_html?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label_type?: string
          name?: string
          state?: string | null
          template_config?: Json | null
          template_html?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      license_expiration_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          client_id: string
          id: string
          sent_at: string | null
          tenant_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          client_id: string
          id?: string
          sent_at?: string | null
          tenant_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          client_id?: string
          id?: string
          sent_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_expiration_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_expiration_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_inventory: {
        Row: {
          created_at: string | null
          id: string
          location_id: string | null
          product_id: string | null
          quantity: number | null
          reorder_point: number | null
          reserved_quantity: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_id?: string | null
          quantity?: number | null
          reorder_point?: number | null
          reserved_quantity?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_id?: string | null
          quantity?: number | null
          reorder_point?: number | null
          reserved_quantity?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          account_id: string
          address: string
          city: string | null
          coordinates: Json | null
          created_at: string | null
          delivery_radius_miles: number | null
          email: string | null
          id: string
          license_number: string | null
          name: string
          operating_hours: Json | null
          phone: string | null
          state: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address: string
          city?: string | null
          coordinates?: Json | null
          created_at?: string | null
          delivery_radius_miles?: number | null
          email?: string | null
          id?: string
          license_number?: string | null
          name: string
          operating_hours?: Json | null
          phone?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string
          city?: string | null
          coordinates?: Json | null
          created_at?: string | null
          delivery_radius_miles?: number | null
          email?: string | null
          id?: string
          license_number?: string | null
          name?: string
          operating_hours?: Json | null
          phone?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          created_at: string | null
          id: string
          lifetime_points: number
          points: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lifetime_points?: number
          points?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lifetime_points?: number
          points?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loyalty_program_config: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          points_per_dollar: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          points_per_dollar?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          points_per_dollar?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_program_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_reward_redemptions: {
        Row: {
          customer_id: string
          id: string
          points_spent: number
          redeemed_at: string | null
          reward_id: string | null
          tenant_id: string
        }
        Insert: {
          customer_id: string
          id?: string
          points_spent: number
          redeemed_at?: string | null
          reward_id?: string | null
          tenant_id: string
        }
        Update: {
          customer_id?: string
          id?: string
          points_spent?: number
          redeemed_at?: string | null
          reward_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          points_required: number
          reward_description: string | null
          reward_name: string
          reward_type: string
          reward_value: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          points_required: number
          reward_description?: string | null
          reward_name: string
          reward_type: string
          reward_value?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          points_required?: number
          reward_description?: string | null
          reward_name?: string
          reward_type?: string
          reward_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          benefits: Json | null
          created_at: string | null
          id: string
          min_points: number
          name: string
          tenant_id: string
        }
        Insert: {
          benefits?: Json | null
          created_at?: string | null
          id?: string
          min_points: number
          name: string
          tenant_id: string
        }
        Update: {
          benefits?: Json | null
          created_at?: string | null
          id?: string
          min_points?: number
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          audience: string | null
          clicked_count: number | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          opened_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          status: string | null
          subject: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          audience?: string | null
          clicked_count?: number | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          audience?: string | null
          clicked_count?: number | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_workflows: {
        Row: {
          actions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          run_count: number | null
          status: string | null
          tenant_id: string
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number | null
          status?: string | null
          tenant_id: string
          trigger_conditions?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number | null
          status?: string | null
          tenant_id?: string
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_banners: {
        Row: {
          button_link: string | null
          button_text: string | null
          created_at: string | null
          display_order: number | null
          heading: string | null
          id: string
          image_url: string
          is_active: boolean | null
          store_id: string
          subheading: string | null
          updated_at: string | null
        }
        Insert: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string | null
          display_order?: number | null
          heading?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          store_id: string
          subheading?: string | null
          updated_at?: string | null
        }
        Update: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string | null
          display_order?: number | null
          heading?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          store_id?: string
          subheading?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_carousels: {
        Row: {
          background_color: string | null
          card_style: string | null
          created_at: string | null
          filter_category: string | null
          filter_tag: string | null
          filter_type: string
          id: string
          is_active: boolean | null
          max_items: number | null
          sort_order: number | null
          store_id: string
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          card_style?: string | null
          created_at?: string | null
          filter_category?: string | null
          filter_tag?: string | null
          filter_type?: string
          id?: string
          is_active?: boolean | null
          max_items?: number | null
          sort_order?: number | null
          store_id: string
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          card_style?: string | null
          created_at?: string | null
          filter_category?: string | null
          filter_tag?: string | null
          filter_type?: string
          id?: string
          is_active?: boolean | null
          max_items?: number | null
          sort_order?: number | null
          store_id?: string
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_carousels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_cart: {
        Row: {
          added_at: string | null
          buyer_tenant_id: string
          id: string
          listing_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          added_at?: string | null
          buyer_tenant_id: string
          id?: string
          listing_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          added_at?: string | null
          buyer_tenant_id?: string
          id?: string
          listing_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_cart_buyer_tenant_id_fkey"
            columns: ["buyer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cart_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_coupons: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          min_order_amount: number | null
          start_date: string | null
          store_id: string
          updated_at: string | null
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          start_date?: string | null
          store_id: string
          updated_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          start_date?: string | null
          store_id?: string
          updated_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_deals: {
        Row: {
          active_days: number[] | null
          applies_to: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          first_time_only: boolean | null
          id: string
          is_active: boolean | null
          max_uses_per_customer: number | null
          min_order_amount: number | null
          name: string
          start_date: string | null
          store_id: string
          target_value: string | null
          updated_at: string | null
        }
        Insert: {
          active_days?: number[] | null
          applies_to?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          first_time_only?: boolean | null
          id?: string
          is_active?: boolean | null
          max_uses_per_customer?: number | null
          min_order_amount?: number | null
          name: string
          start_date?: string | null
          store_id: string
          target_value?: string | null
          updated_at?: string | null
        }
        Update: {
          active_days?: number[] | null
          applies_to?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          first_time_only?: boolean | null
          id?: string
          is_active?: boolean | null
          max_uses_per_customer?: number | null
          min_order_amount?: number | null
          name?: string
          start_date?: string | null
          store_id?: string
          target_value?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_deals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          available_states: string[] | null
          base_price: number
          cbd_content: number | null
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          lab_results_encrypted: string | null
          lab_results_url: string | null
          marketplace_profile_id: string | null
          product_name: string
          product_type: string | null
          quantity_available: number
          seller_tenant_id: string
          status: string | null
          strain_name: string | null
          thc_content: number | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          available_states?: string[] | null
          base_price: number
          cbd_content?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          lab_results_encrypted?: string | null
          lab_results_url?: string | null
          marketplace_profile_id?: string | null
          product_name: string
          product_type?: string | null
          quantity_available?: number
          seller_tenant_id: string
          status?: string | null
          strain_name?: string | null
          thc_content?: number | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          available_states?: string[] | null
          base_price?: number
          cbd_content?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          lab_results_encrypted?: string | null
          lab_results_url?: string | null
          marketplace_profile_id?: string | null
          product_name?: string
          product_type?: string | null
          quantity_available?: number
          seller_tenant_id?: string
          status?: string | null
          strain_name?: string | null
          thc_content?: number | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_marketplace_profile_id_fkey"
            columns: ["marketplace_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_tenant_id_fkey"
            columns: ["seller_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string | null
          order_id: string
          product_name: string
          product_type: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          order_id: string
          product_name: string
          product_type?: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          order_id?: string
          product_name?: string
          product_type?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "storefront_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_notes: string | null
          buyer_tenant_id: string
          buyer_user_id: string | null
          confirmed_at: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_notes: string | null
          id: string
          items: Json | null
          order_number: string
          paid_at: string | null
          payment_status: string | null
          payment_terms: string | null
          platform_fee: number | null
          seller_notes: string | null
          seller_profile_id: string | null
          seller_tenant_id: string
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_method: string | null
          status: string | null
          store_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          tax: number | null
          total_amount: number
          tracking_number: string | null
          tracking_token: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_notes?: string | null
          buyer_tenant_id: string
          buyer_user_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          id?: string
          items?: Json | null
          order_number: string
          paid_at?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          platform_fee?: number | null
          seller_notes?: string | null
          seller_profile_id?: string | null
          seller_tenant_id: string
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string | null
          store_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax?: number | null
          total_amount?: number
          tracking_number?: string | null
          tracking_token?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_notes?: string | null
          buyer_tenant_id?: string
          buyer_user_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          id?: string
          items?: Json | null
          order_number?: string
          paid_at?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          platform_fee?: number | null
          seller_notes?: string | null
          seller_profile_id?: string | null
          seller_tenant_id?: string
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string | null
          store_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax?: number | null
          total_amount?: number
          tracking_number?: string | null
          tracking_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_buyer_tenant_id_fkey"
            columns: ["buyer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_tenant_id_fkey"
            columns: ["seller_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_settings: {
        Row: {
          created_at: string | null
          custom_description: string | null
          custom_price: number | null
          display_order: number | null
          featured: boolean | null
          id: string
          is_visible: boolean | null
          product_id: string
          slug: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_description?: string | null
          custom_price?: number | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          is_visible?: boolean | null
          product_id: string
          slug?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_description?: string | null
          custom_price?: number | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          is_visible?: boolean | null
          product_id?: string
          slug?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_profiles: {
        Row: {
          business_description: string | null
          business_name: string | null
          can_sell: boolean | null
          cover_image_url: string | null
          created_at: string | null
          id: string
          license_document_url: string | null
          license_expiry_date: string | null
          license_number: string | null
          license_state: string | null
          license_type: string | null
          license_verification_notes: string | null
          license_verified: boolean | null
          license_verified_at: string | null
          logo_url: string | null
          marketplace_status: string | null
          return_policy: string | null
          shipping_policy: string | null
          shipping_states: string[] | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          business_description?: string | null
          business_name?: string | null
          can_sell?: boolean | null
          cover_image_url?: string | null
          created_at?: string | null
          id?: string
          license_document_url?: string | null
          license_expiry_date?: string | null
          license_number?: string | null
          license_state?: string | null
          license_type?: string | null
          license_verification_notes?: string | null
          license_verified?: boolean | null
          license_verified_at?: string | null
          logo_url?: string | null
          marketplace_status?: string | null
          return_policy?: string | null
          shipping_policy?: string | null
          shipping_states?: string[] | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          business_description?: string | null
          business_name?: string | null
          can_sell?: boolean | null
          cover_image_url?: string | null
          created_at?: string | null
          id?: string
          license_document_url?: string | null
          license_expiry_date?: string | null
          license_number?: string | null
          license_state?: string | null
          license_type?: string | null
          license_verification_notes?: string | null
          license_verified?: boolean | null
          license_verified_at?: string | null
          logo_url?: string | null
          marketplace_status?: string | null
          return_policy?: string | null
          shipping_policy?: string | null
          shipping_states?: string[] | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          is_approved: boolean | null
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          store_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          is_approved?: boolean | null
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          store_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          is_approved?: boolean | null
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          store_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_stores: {
        Row: {
          accent_color: string | null
          banner_url: string | null
          checkout_settings: Json | null
          created_at: string | null
          custom_domain: string | null
          default_delivery_fee: number | null
          delivery_zones: Json | null
          description: string | null
          encrypted_url_token: string | null
          favicon_url: string | null
          font_family: string | null
          free_delivery_threshold: number | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          layout_config: Json | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          minimum_age: number | null
          og_image_url: string | null
          operating_hours: Json | null
          payment_methods: Json | null
          primary_color: string | null
          require_account: boolean | null
          require_age_verification: boolean | null
          secondary_color: string | null
          slug: string
          store_name: string
          tagline: string | null
          tenant_id: string
          theme_config: Json | null
          total_customers: number | null
          total_orders: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          banner_url?: string | null
          checkout_settings?: Json | null
          created_at?: string | null
          custom_domain?: string | null
          default_delivery_fee?: number | null
          delivery_zones?: Json | null
          description?: string | null
          encrypted_url_token?: string | null
          favicon_url?: string | null
          font_family?: string | null
          free_delivery_threshold?: number | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          minimum_age?: number | null
          og_image_url?: string | null
          operating_hours?: Json | null
          payment_methods?: Json | null
          primary_color?: string | null
          require_account?: boolean | null
          require_age_verification?: boolean | null
          secondary_color?: string | null
          slug: string
          store_name: string
          tagline?: string | null
          tenant_id: string
          theme_config?: Json | null
          total_customers?: number | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          banner_url?: string | null
          checkout_settings?: Json | null
          created_at?: string | null
          custom_domain?: string | null
          default_delivery_fee?: number | null
          delivery_zones?: Json | null
          description?: string | null
          encrypted_url_token?: string | null
          favicon_url?: string | null
          font_family?: string | null
          free_delivery_threshold?: number | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          minimum_age?: number | null
          og_image_url?: string | null
          operating_hours?: Json | null
          payment_methods?: Json | null
          primary_color?: string | null
          require_account?: boolean | null
          require_age_verification?: boolean | null
          secondary_color?: string | null
          slug?: string
          store_name?: string
          tagline?: string | null
          tenant_id?: string
          theme_config?: Json | null
          total_customers?: number | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_stores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_patient_info: {
        Row: {
          account_id: string
          card_expiration: string | null
          card_number: string | null
          created_at: string | null
          customer_id: string
          dosage_recommendations: string | null
          id: string
          monthly_allotment: number | null
          notes: string | null
          physician_name: string | null
          physician_phone: string | null
          qualifying_conditions: string[] | null
          state_issued: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          card_expiration?: string | null
          card_number?: string | null
          created_at?: string | null
          customer_id: string
          dosage_recommendations?: string | null
          id?: string
          monthly_allotment?: number | null
          notes?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          qualifying_conditions?: string[] | null
          state_issued?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          card_expiration?: string | null
          card_number?: string | null
          created_at?: string | null
          customer_id?: string
          dosage_recommendations?: string | null
          id?: string
          monthly_allotment?: number | null
          notes?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          qualifying_conditions?: string[] | null
          state_issued?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_patient_info_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_access: {
        Row: {
          access_code: string
          created_at: string | null
          customer_id: string | null
          expires_at: string | null
          id: string
          menu_id: string | null
        }
        Insert: {
          access_code: string
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          menu_id?: string | null
        }
        Update: {
          access_code?: string
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          menu_id?: string | null
        }
        Relationships: []
      }
      menu_access_code_history: {
        Row: {
          id: string
          menu_id: string | null
          new_code_hash: string
          old_code_hash: string | null
          reason: string | null
          rotated_at: string | null
          rotated_by: string | null
        }
        Insert: {
          id?: string
          menu_id?: string | null
          new_code_hash: string
          old_code_hash?: string | null
          reason?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
        }
        Update: {
          id?: string
          menu_id?: string | null
          new_code_hash?: string
          old_code_hash?: string | null
          reason?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_access_code_history_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_code_history_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_code_history_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_access_logs: {
        Row: {
          access_code_correct: boolean | null
          access_whitelist_id: string | null
          accessed_at: string
          actions_taken: Json | null
          device_fingerprint: string | null
          geofence_pass: boolean | null
          id: string
          ip_address: string | null
          location: Json | null
          menu_id: string
          session_duration_seconds: number | null
          suspicious_flags: string[] | null
          time_restriction_pass: boolean | null
          user_agent: string | null
        }
        Insert: {
          access_code_correct?: boolean | null
          access_whitelist_id?: string | null
          accessed_at?: string
          actions_taken?: Json | null
          device_fingerprint?: string | null
          geofence_pass?: boolean | null
          id?: string
          ip_address?: string | null
          location?: Json | null
          menu_id: string
          session_duration_seconds?: number | null
          suspicious_flags?: string[] | null
          time_restriction_pass?: boolean | null
          user_agent?: string | null
        }
        Update: {
          access_code_correct?: boolean | null
          access_whitelist_id?: string | null
          accessed_at?: string
          actions_taken?: Json | null
          device_fingerprint?: string | null
          geofence_pass?: boolean | null
          id?: string
          ip_address?: string | null
          location?: Json | null
          menu_id?: string
          session_duration_seconds?: number | null
          suspicious_flags?: string[] | null
          time_restriction_pass?: boolean | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_access_logs_access_whitelist_id_fkey"
            columns: ["access_whitelist_id"]
            isOneToOne: false
            referencedRelation: "menu_access_whitelist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_logs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_logs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_logs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_access_whitelist: {
        Row: {
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          device_fingerprint: string | null
          first_access_at: string | null
          id: string
          invited_at: string
          invited_by: string | null
          last_access_at: string | null
          menu_id: string
          revoked_at: string | null
          revoked_reason: string | null
          status: Database["public"]["Enums"]["whitelist_status"]
          unique_access_token: string
          view_count: number
        }
        Insert: {
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          device_fingerprint?: string | null
          first_access_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_access_at?: string | null
          menu_id: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: Database["public"]["Enums"]["whitelist_status"]
          unique_access_token: string
          view_count?: number
        }
        Update: {
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          device_fingerprint?: string | null
          first_access_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_access_at?: string | null
          menu_id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: Database["public"]["Enums"]["whitelist_status"]
          unique_access_token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_access_whitelist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_whitelist_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_whitelist_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_access_whitelist_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_burn_history: {
        Row: {
          burn_reason: string
          burn_type: Database["public"]["Enums"]["burn_type"]
          burned_at: string
          burned_by: string
          customers_migrated: number
          id: string
          menu_id: string
          regenerated_menu_id: string | null
          stats_snapshot: Json
        }
        Insert: {
          burn_reason: string
          burn_type: Database["public"]["Enums"]["burn_type"]
          burned_at?: string
          burned_by: string
          customers_migrated?: number
          id?: string
          menu_id: string
          regenerated_menu_id?: string | null
          stats_snapshot?: Json
        }
        Update: {
          burn_reason?: string
          burn_type?: Database["public"]["Enums"]["burn_type"]
          burned_at?: string
          burned_by?: string
          customers_migrated?: number
          id?: string
          menu_id?: string
          regenerated_menu_id?: string | null
          stats_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "menu_burn_history_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_burn_history_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_burn_history_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "menu_burn_history_regenerated_menu_id_fkey"
            columns: ["regenerated_menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_burn_history_regenerated_menu_id_fkey"
            columns: ["regenerated_menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_burn_history_regenerated_menu_id_fkey"
            columns: ["regenerated_menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_decryption_audit: {
        Row: {
          access_method: string
          decrypted_at: string
          decrypted_by: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          menu_id: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          access_method: string
          decrypted_at?: string
          decrypted_by?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          menu_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          access_method?: string
          decrypted_at?: string
          decrypted_by?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          menu_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_decryption_audit_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_decryption_audit_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_decryption_audit_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_device_locks: {
        Row: {
          access_count: number | null
          created_at: string | null
          customer_id: string | null
          device_fingerprint: string
          device_info: Json | null
          first_access_at: string | null
          id: string
          is_locked: boolean | null
          last_access_at: string | null
          menu_id: string | null
          whitelist_entry_id: string | null
        }
        Insert: {
          access_count?: number | null
          created_at?: string | null
          customer_id?: string | null
          device_fingerprint: string
          device_info?: Json | null
          first_access_at?: string | null
          id?: string
          is_locked?: boolean | null
          last_access_at?: string | null
          menu_id?: string | null
          whitelist_entry_id?: string | null
        }
        Update: {
          access_count?: number | null
          created_at?: string | null
          customer_id?: string | null
          device_fingerprint?: string
          device_info?: Json | null
          first_access_at?: string | null
          id?: string
          is_locked?: boolean | null
          last_access_at?: string | null
          menu_id?: string | null
          whitelist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_device_locks_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_device_locks_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_device_locks_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_honeypots: {
        Row: {
          access_count: number | null
          created_at: string | null
          description: string | null
          first_accessed_at: string | null
          honeypot_token: string
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          menu_id: string | null
          suspected_leaker_id: string | null
          suspected_leaker_name: string | null
        }
        Insert: {
          access_count?: number | null
          created_at?: string | null
          description?: string | null
          first_accessed_at?: string | null
          honeypot_token: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          menu_id?: string | null
          suspected_leaker_id?: string | null
          suspected_leaker_name?: string | null
        }
        Update: {
          access_count?: number | null
          created_at?: string | null
          description?: string | null
          first_accessed_at?: string | null
          honeypot_token?: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          menu_id?: string | null
          suspected_leaker_id?: string | null
          suspected_leaker_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_honeypots_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_honeypots_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_honeypots_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_orders: {
        Row: {
          access_whitelist_id: string | null
          client_id: string | null
          contact_phone: string
          converted_at: string | null
          converted_to_invoice_id: string | null
          created_at: string
          customer_notes: string | null
          delivery_address: string | null
          delivery_method: string | null
          id: string
          items: Json | null
          menu_id: string
          order_data: Json
          payment_method: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["menu_order_status"]
          synced_invoice_id: string | null
          synced_order_id: string | null
          tenant_id: string
          total_amount: number
        }
        Insert: {
          access_whitelist_id?: string | null
          client_id?: string | null
          contact_phone: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string
          customer_notes?: string | null
          delivery_address?: string | null
          delivery_method?: string | null
          id?: string
          items?: Json | null
          menu_id: string
          order_data: Json
          payment_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["menu_order_status"]
          synced_invoice_id?: string | null
          synced_order_id?: string | null
          tenant_id: string
          total_amount: number
        }
        Update: {
          access_whitelist_id?: string | null
          client_id?: string | null
          contact_phone?: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string
          customer_notes?: string | null
          delivery_address?: string | null
          delivery_method?: string | null
          id?: string
          items?: Json | null
          menu_id?: string
          order_data?: Json
          payment_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["menu_order_status"]
          synced_invoice_id?: string | null
          synced_order_id?: string | null
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_orders_access_whitelist_id_fkey"
            columns: ["access_whitelist_id"]
            isOneToOne: false
            referencedRelation: "menu_access_whitelist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "menu_orders_synced_invoice_id_fkey"
            columns: ["synced_invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_synced_order_id_fkey"
            columns: ["synced_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_panic_events: {
        Row: {
          actions_taken: Json | null
          affected_menus: Json | null
          id: string
          notifications_sent: Json | null
          reason: string | null
          triggered_at: string | null
          triggered_by: string | null
        }
        Insert: {
          actions_taken?: Json | null
          affected_menus?: Json | null
          id?: string
          notifications_sent?: Json | null
          reason?: string | null
          triggered_at?: string | null
          triggered_by?: string | null
        }
        Update: {
          actions_taken?: Json | null
          affected_menus?: Json | null
          id?: string
          notifications_sent?: Json | null
          reason?: string | null
          triggered_at?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      menu_products: {
        Row: {
          created_at: string | null
          id: string
          menu_id: string | null
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_id?: string | null
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_id?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_screenshot_attempts: {
        Row: {
          action_taken: string | null
          attempted_at: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          menu_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_taken?: string | null
          attempted_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          menu_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_taken?: string | null
          attempted_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          menu_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_screenshot_attempts_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_screenshot_attempts_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_screenshot_attempts_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_security_events: {
        Row: {
          access_whitelist_id: string | null
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          event_data: Json
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          menu_id: string
          severity: Database["public"]["Enums"]["event_severity"]
        }
        Insert: {
          access_whitelist_id?: string | null
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          event_data?: Json
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          menu_id: string
          severity?: Database["public"]["Enums"]["event_severity"]
        }
        Update: {
          access_whitelist_id?: string | null
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          event_data?: Json
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          menu_id?: string
          severity?: Database["public"]["Enums"]["event_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "menu_security_events_access_whitelist_id_fkey"
            columns: ["access_whitelist_id"]
            isOneToOne: false
            referencedRelation: "menu_access_whitelist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_security_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_security_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_security_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menu_view_tracking: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          last_view_at: string | null
          limit_exceeded: boolean | null
          menu_id: string | null
          period_end: string
          period_start: string
          updated_at: string | null
          view_count: number | null
          whitelist_entry_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_view_at?: string | null
          limit_exceeded?: boolean | null
          menu_id?: string | null
          period_end: string
          period_start: string
          updated_at?: string | null
          view_count?: number | null
          whitelist_entry_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_view_at?: string | null
          limit_exceeded?: boolean | null
          menu_id?: string | null
          period_end?: string
          period_start?: string
          updated_at?: string | null
          view_count?: number | null
          whitelist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_view_tracking_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_view_tracking_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_view_tracking_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      merchants: {
        Row: {
          address: string
          borough: string
          business_name: string
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          latitude: number | null
          license_number: string
          license_verified: boolean | null
          longitude: number | null
          phone: string
          service_radius: number | null
          updated_at: string | null
        }
        Insert: {
          address: string
          borough: string
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          license_number: string
          license_verified?: boolean | null
          longitude?: number | null
          phone: string
          service_radius?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          borough?: string
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          license_number?: string
          license_verified?: boolean | null
          longitude?: number | null
          phone?: string
          service_radius?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          id: string
          message_type: string | null
          read_at: string | null
          sender_id: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          sender_id: string
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_log: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          max_retries: number | null
          message_preview: string | null
          metadata: Json | null
          next_retry_at: string | null
          notification_type: string
          recipient: string
          retry_count: number | null
          sent_at: string | null
          status: string
          subject: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number | null
          message_preview?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          notification_type: string
          recipient: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number | null
          message_preview?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          notification_type?: string
          recipient?: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_all_updates: boolean | null
          email_confirmation_only: boolean | null
          email_enabled: boolean | null
          id: string
          push_all_updates: boolean | null
          push_critical_only: boolean | null
          push_enabled: boolean | null
          sms_all_updates: boolean | null
          sms_critical_only: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_all_updates?: boolean | null
          email_confirmation_only?: boolean | null
          email_enabled?: boolean | null
          id?: string
          push_all_updates?: boolean | null
          push_critical_only?: boolean | null
          push_enabled?: boolean | null
          sms_all_updates?: boolean | null
          sms_critical_only?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_all_updates?: boolean | null
          email_confirmation_only?: boolean | null
          email_enabled?: boolean | null
          id?: string
          push_all_updates?: boolean | null
          push_critical_only?: boolean | null
          push_enabled?: boolean | null
          sms_all_updates?: boolean | null
          sms_critical_only?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          tenant_id: string
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_content: string
          notification_stage: number
          notification_type: string
          order_id: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          notification_stage: number
          notification_type: string
          order_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          notification_stage?: number
          notification_type?: string
          order_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          price: number
          product_id: string
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id: string
          product_name: string
          quantity: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_id: string | null
          created_at: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_id?: string | null
          created_at?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_id?: string | null
          created_at?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking: {
        Row: {
          created_at: string | null
          id: string
          lat: number | null
          lng: number | null
          message: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          account_id: string | null
          address_id: string | null
          cashier_id: string | null
          courier_accepted_at: string | null
          courier_assigned_at: string | null
          courier_feedback: string | null
          courier_id: string | null
          courier_rating: number | null
          created_at: string | null
          customer_id: string | null
          customer_lat: number | null
          customer_lng: number | null
          customer_location_accuracy: number | null
          customer_location_enabled: boolean | null
          customer_location_updated_at: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_signature_url: string | null
          delivered_at: string | null
          delivery_address: string
          delivery_borough: string
          delivery_fee: number
          delivery_notes: string | null
          delivery_scheduled_at: string | null
          discount_amount: number | null
          discount_reason: string | null
          distance_miles: number | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          estimated_delivery: string | null
          eta_minutes: number | null
          eta_updated_at: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          id: string
          last_notification_sent_at: string | null
          merchant_id: string | null
          notification_sent_stage_1: boolean | null
          notification_sent_stage_2: boolean | null
          notification_sent_stage_3: boolean | null
          notification_sent_stage_4: boolean | null
          notification_sent_stage_5: boolean | null
          notification_sent_stage_6: boolean | null
          notification_sent_stage_7: boolean | null
          notification_sent_stage_8: boolean | null
          order_number: string | null
          order_type: string | null
          payment_method: string
          payment_status: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          proof_of_delivery_url: string | null
          requires_id_check: boolean | null
          scheduled_delivery_time: string | null
          special_instructions: string | null
          status: string
          subtotal: number
          tenant_id: string | null
          tip_amount: number | null
          total_amount: number
          tracking_code: string | null
          tracking_url: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          accepted_at?: string | null
          account_id?: string | null
          address_id?: string | null
          cashier_id?: string | null
          courier_accepted_at?: string | null
          courier_assigned_at?: string | null
          courier_feedback?: string | null
          courier_id?: string | null
          courier_rating?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_lat?: number | null
          customer_lng?: number | null
          customer_location_accuracy?: number | null
          customer_location_enabled?: boolean | null
          customer_location_updated_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_signature_url?: string | null
          delivered_at?: string | null
          delivery_address: string
          delivery_borough: string
          delivery_fee: number
          delivery_notes?: string | null
          delivery_scheduled_at?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          distance_miles?: number | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          estimated_delivery?: string | null
          eta_minutes?: number | null
          eta_updated_at?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          last_notification_sent_at?: string | null
          merchant_id?: string | null
          notification_sent_stage_1?: boolean | null
          notification_sent_stage_2?: boolean | null
          notification_sent_stage_3?: boolean | null
          notification_sent_stage_4?: boolean | null
          notification_sent_stage_5?: boolean | null
          notification_sent_stage_6?: boolean | null
          notification_sent_stage_7?: boolean | null
          notification_sent_stage_8?: boolean | null
          order_number?: string | null
          order_type?: string | null
          payment_method: string
          payment_status?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          proof_of_delivery_url?: string | null
          requires_id_check?: boolean | null
          scheduled_delivery_time?: string | null
          special_instructions?: string | null
          status?: string
          subtotal: number
          tenant_id?: string | null
          tip_amount?: number | null
          total_amount: number
          tracking_code?: string | null
          tracking_url?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          accepted_at?: string | null
          account_id?: string | null
          address_id?: string | null
          cashier_id?: string | null
          courier_accepted_at?: string | null
          courier_assigned_at?: string | null
          courier_feedback?: string | null
          courier_id?: string | null
          courier_rating?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_lat?: number | null
          customer_lng?: number | null
          customer_location_accuracy?: number | null
          customer_location_enabled?: boolean | null
          customer_location_updated_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_signature_url?: string | null
          delivered_at?: string | null
          delivery_address?: string
          delivery_borough?: string
          delivery_fee?: number
          delivery_notes?: string | null
          delivery_scheduled_at?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          distance_miles?: number | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          estimated_delivery?: string | null
          eta_minutes?: number | null
          eta_updated_at?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          last_notification_sent_at?: string | null
          merchant_id?: string | null
          notification_sent_stage_1?: boolean | null
          notification_sent_stage_2?: boolean | null
          notification_sent_stage_3?: boolean | null
          notification_sent_stage_4?: boolean | null
          notification_sent_stage_5?: boolean | null
          notification_sent_stage_6?: boolean | null
          notification_sent_stage_7?: boolean | null
          notification_sent_stage_8?: boolean | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string
          payment_status?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          proof_of_delivery_url?: string | null
          requires_id_check?: boolean | null
          scheduled_delivery_time?: string | null
          special_instructions?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          tip_amount?: number | null
          total_amount?: number
          tracking_code?: string | null
          tracking_url?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_courier"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      override_requests: {
        Row: {
          admin_notes: string | null
          courier_id: string
          created_at: string | null
          current_distance_miles: number
          customer_location_lat: number
          customer_location_lng: number
          driver_location_lat: number
          driver_location_lng: number
          id: string
          order_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          courier_id: string
          created_at?: string | null
          current_distance_miles: number
          customer_location_lat: number
          customer_location_lng: number
          driver_location_lat: number
          driver_location_lng: number
          id?: string
          order_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          courier_id?: string
          created_at?: string | null
          current_distance_miles?: number
          customer_location_lat?: number
          customer_location_lng?: number
          driver_location_lat?: number
          driver_location_lng?: number
          id?: string
          order_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "override_requests_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "override_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "override_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          card_holder_name: string | null
          card_last_four: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          payment_type: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          card_brand?: string | null
          card_holder_name?: string | null
          card_last_four?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          payment_type: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          card_brand?: string | null
          card_holder_name?: string | null
          card_last_four?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          payment_type?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          account_id: string
          amount: number
          customer_id: string
          external_reference: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          payment_method: string
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          customer_id: string
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          payment_method: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          customer_id?: string
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          created_by: string | null
          due_date: string
          id: string
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string | null
          created_by?: string | null
          due_date: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      phi_access_audit: {
        Row: {
          action: string
          created_at: string
          customer_id: string
          fields_accessed: string[] | null
          id: string
          ip_address: string | null
          purpose: string | null
          session_id: string | null
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          customer_id: string
          fields_accessed?: string[] | null
          id?: string
          ip_address?: string | null
          purpose?: string | null
          session_id?: string | null
          tenant_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          customer_id?: string
          fields_accessed?: string[] | null
          id?: string
          ip_address?: string | null
          purpose?: string | null
          session_id?: string | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phi_access_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phi_access_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_locations: number
          max_orders_per_month: number | null
          max_products: number
          max_team_members: number
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_locations: number
          max_orders_per_month?: number | null
          max_products: number
          max_team_members: number
          name: string
          price_monthly: number
          price_yearly?: number | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_locations?: number
          max_orders_per_month?: number | null
          max_products?: number
          max_team_members?: number
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_invoices: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          due_date: string
          id: string
          invoice_number: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          status: string | null
          stripe_invoice_id: string | null
          tax: number | null
          total: number
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          tax?: number | null
          total: number
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          tax?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          fee_percentage: number | null
          id: string
          metadata: Json | null
          order_id: string | null
          processed_at: string | null
          status: string | null
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          fee_percentage?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          processed_at?: string | null
          status?: string | null
          tenant_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          fee_percentage?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          processed_at?: string | null
          status?: string | null
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "storefront_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_cash_drawer_events: {
        Row: {
          amount: number
          created_at: string
          event_type: string
          id: string
          performed_by: string
          performed_by_name: string
          reason: string | null
          shift_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_type: string
          id?: string
          performed_by: string
          performed_by_name: string
          reason?: string | null
          shift_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_type?: string
          id?: string
          performed_by?: string
          performed_by_name?: string
          reason?: string | null
          shift_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_cash_drawer_events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_shifts: {
        Row: {
          card_sales: number | null
          cash_difference: number | null
          cash_sales: number | null
          cashier_id: string
          cashier_name: string
          closing_cash: number | null
          created_at: string
          ended_at: string | null
          expected_cash: number | null
          id: string
          notes: string | null
          opening_cash: number
          other_sales: number | null
          refunds_amount: number | null
          shift_number: string
          started_at: string
          status: string
          tenant_id: string
          terminal_id: string
          total_sales: number | null
          total_transactions: number | null
          updated_at: string
          z_report: Json | null
        }
        Insert: {
          card_sales?: number | null
          cash_difference?: number | null
          cash_sales?: number | null
          cashier_id: string
          cashier_name: string
          closing_cash?: number | null
          created_at?: string
          ended_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opening_cash?: number
          other_sales?: number | null
          refunds_amount?: number | null
          shift_number: string
          started_at?: string
          status?: string
          tenant_id: string
          terminal_id: string
          total_sales?: number | null
          total_transactions?: number | null
          updated_at?: string
          z_report?: Json | null
        }
        Update: {
          card_sales?: number | null
          cash_difference?: number | null
          cash_sales?: number | null
          cashier_id?: string
          cashier_name?: string
          closing_cash?: number | null
          created_at?: string
          ended_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opening_cash?: number
          other_sales?: number | null
          refunds_amount?: number | null
          shift_number?: string
          started_at?: string
          status?: string
          tenant_id?: string
          terminal_id?: string
          total_sales?: number | null
          total_transactions?: number | null
          updated_at?: string
          z_report?: Json | null
        }
        Relationships: []
      }
      pos_transaction_voids: {
        Row: {
          created_at: string | null
          id: string
          inventory_restored: boolean | null
          original_items: Json | null
          reason: string
          tenant_id: string
          transaction_id: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_restored?: boolean | null
          original_items?: Json | null
          reason: string
          tenant_id: string
          transaction_id: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_restored?: boolean | null
          original_items?: Json | null
          reason?: string
          tenant_id?: string
          transaction_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transaction_voids_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transaction_voids_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          cashier_id: string | null
          cashier_name: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          id: string
          items: Json
          notes: string | null
          payment_method: string
          payment_status: string
          receipt_number: string | null
          shift_id: string | null
          subtotal: number
          tax_amount: number | null
          tenant_id: string
          terminal_id: string | null
          total_amount: number
          transaction_number: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          cashier_id?: string | null
          cashier_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method: string
          payment_status?: string
          receipt_number?: string | null
          shift_id?: string | null
          subtotal: number
          tax_amount?: number | null
          tenant_id: string
          terminal_id?: string | null
          total_amount: number
          transaction_number: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          cashier_id?: string | null
          cashier_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          payment_status?: string
          receipt_number?: string | null
          shift_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id?: string
          terminal_id?: string | null
          total_amount?: number
          transaction_number?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      product_documents: {
        Row: {
          created_at: string | null
          created_by: string | null
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          product_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          content: string
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          helpful_count: number | null
          id: string
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          status: string | null
          store_id: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          helpful_count?: number | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          status?: string | null
          store_id?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          helpful_count?: number | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          status?: string | null
          store_id?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          account_id: string
          discount: number | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          sold_at: string | null
          sold_by: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          account_id: string
          discount?: number | null
          id?: string
          order_id: string
          product_id: string
          quantity: number
          sold_at?: string | null
          sold_by?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          account_id?: string
          discount?: number | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          sold_at?: string | null
          sold_by?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_quantity: number | null
          average_rating: number | null
          barcode: string | null
          batch_number: string | null
          category: string
          category_id: string | null
          cbd_content: number | null
          cbd_percent: number | null
          coa_pdf_url: string | null
          coa_qr_code_url: string | null
          coa_url: string | null
          consumption_methods: string[] | null
          cost_per_unit: number | null
          created_at: string | null
          description: string | null
          effects: string[] | null
          effects_timeline: Json | null
          fronted_quantity: number | null
          growing_info: Json | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          is_concentrate: boolean | null
          lab_name: string | null
          lab_results_url: string | null
          low_stock_alert: number | null
          medical_benefits: string[] | null
          menu_visibility: boolean
          merchant_id: string | null
          name: string
          price: number
          price_per_lb: number | null
          prices: Json | null
          reserved_quantity: number | null
          retail_price: number | null
          review_count: number | null
          sale_price: number | null
          sku: string | null
          stock_quantity: number | null
          strain_info: string | null
          strain_lineage: string | null
          strain_name: string | null
          strain_type: string | null
          tenant_id: string | null
          terpenes: Json | null
          test_date: string | null
          thc_content: number | null
          thc_percent: number | null
          thca_percentage: number
          total_quantity: number | null
          usage_tips: string | null
          vendor_name: string | null
          version: number | null
          weight_grams: number | null
          wholesale_price: number | null
        }
        Insert: {
          available_quantity?: number | null
          average_rating?: number | null
          barcode?: string | null
          batch_number?: string | null
          category: string
          category_id?: string | null
          cbd_content?: number | null
          cbd_percent?: number | null
          coa_pdf_url?: string | null
          coa_qr_code_url?: string | null
          coa_url?: string | null
          consumption_methods?: string[] | null
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          effects?: string[] | null
          effects_timeline?: Json | null
          fronted_quantity?: number | null
          growing_info?: Json | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          is_concentrate?: boolean | null
          lab_name?: string | null
          lab_results_url?: string | null
          low_stock_alert?: number | null
          medical_benefits?: string[] | null
          menu_visibility?: boolean
          merchant_id?: string | null
          name: string
          price: number
          price_per_lb?: number | null
          prices?: Json | null
          reserved_quantity?: number | null
          retail_price?: number | null
          review_count?: number | null
          sale_price?: number | null
          sku?: string | null
          stock_quantity?: number | null
          strain_info?: string | null
          strain_lineage?: string | null
          strain_name?: string | null
          strain_type?: string | null
          tenant_id?: string | null
          terpenes?: Json | null
          test_date?: string | null
          thc_content?: number | null
          thc_percent?: number | null
          thca_percentage: number
          total_quantity?: number | null
          usage_tips?: string | null
          vendor_name?: string | null
          version?: number | null
          weight_grams?: number | null
          wholesale_price?: number | null
        }
        Update: {
          available_quantity?: number | null
          average_rating?: number | null
          barcode?: string | null
          batch_number?: string | null
          category?: string
          category_id?: string | null
          cbd_content?: number | null
          cbd_percent?: number | null
          coa_pdf_url?: string | null
          coa_qr_code_url?: string | null
          coa_url?: string | null
          consumption_methods?: string[] | null
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          effects?: string[] | null
          effects_timeline?: Json | null
          fronted_quantity?: number | null
          growing_info?: Json | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          is_concentrate?: boolean | null
          lab_name?: string | null
          lab_results_url?: string | null
          low_stock_alert?: number | null
          medical_benefits?: string[] | null
          menu_visibility?: boolean
          merchant_id?: string | null
          name?: string
          price?: number
          price_per_lb?: number | null
          prices?: Json | null
          reserved_quantity?: number | null
          retail_price?: number | null
          review_count?: number | null
          sale_price?: number | null
          sku?: string | null
          stock_quantity?: number | null
          strain_info?: string | null
          strain_lineage?: string | null
          strain_name?: string | null
          strain_type?: string | null
          tenant_id?: string | null
          terpenes?: Json | null
          test_date?: string | null
          thc_content?: number | null
          thc_percent?: number | null
          thca_percentage?: number
          total_quantity?: number | null
          usage_tips?: string | null
          vendor_name?: string | null
          version?: number | null
          weight_grams?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          account_status: string | null
          age_verified: boolean | null
          average_order_value: number | null
          cancelled_orders: number | null
          chargebacks: number | null
          created_at: string | null
          daily_limit: number | null
          date_of_birth: string | null
          failed_payments: number | null
          first_name: string | null
          full_name: string | null
          id: string
          id_document_url: string | null
          id_expiry_date: string | null
          id_number: string | null
          id_type: string | null
          id_verified: boolean | null
          last_login_at: string | null
          last_name: string | null
          last_order_date: string | null
          lifetime_value: number | null
          login_attempts: number | null
          marketing_opt_in: boolean | null
          name_change_count: number | null
          order_limit: number | null
          phone: string | null
          referral_code: string | null
          reported_issues: number | null
          risk_score: number | null
          selfie_verified: boolean | null
          total_orders: number | null
          total_spent: number | null
          trust_level: string | null
          user_id: string
          user_id_code: string | null
          verification_approved_at: string | null
          verification_rejected_at: string | null
          verification_rejection_reason: string | null
          verification_submitted_at: string | null
          weekly_limit: number | null
        }
        Insert: {
          account_id?: string | null
          account_status?: string | null
          age_verified?: boolean | null
          average_order_value?: number | null
          cancelled_orders?: number | null
          chargebacks?: number | null
          created_at?: string | null
          daily_limit?: number | null
          date_of_birth?: string | null
          failed_payments?: number | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          id_document_url?: string | null
          id_expiry_date?: string | null
          id_number?: string | null
          id_type?: string | null
          id_verified?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          last_order_date?: string | null
          lifetime_value?: number | null
          login_attempts?: number | null
          marketing_opt_in?: boolean | null
          name_change_count?: number | null
          order_limit?: number | null
          phone?: string | null
          referral_code?: string | null
          reported_issues?: number | null
          risk_score?: number | null
          selfie_verified?: boolean | null
          total_orders?: number | null
          total_spent?: number | null
          trust_level?: string | null
          user_id: string
          user_id_code?: string | null
          verification_approved_at?: string | null
          verification_rejected_at?: string | null
          verification_rejection_reason?: string | null
          verification_submitted_at?: string | null
          weekly_limit?: number | null
        }
        Update: {
          account_id?: string | null
          account_status?: string | null
          age_verified?: boolean | null
          average_order_value?: number | null
          cancelled_orders?: number | null
          chargebacks?: number | null
          created_at?: string | null
          daily_limit?: number | null
          date_of_birth?: string | null
          failed_payments?: number | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          id_document_url?: string | null
          id_expiry_date?: string | null
          id_number?: string | null
          id_type?: string | null
          id_verified?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          last_order_date?: string | null
          lifetime_value?: number | null
          login_attempts?: number | null
          marketing_opt_in?: boolean | null
          name_change_count?: number | null
          order_limit?: number | null
          phone?: string | null
          referral_code?: string | null
          reported_issues?: number | null
          risk_score?: number | null
          selfie_verified?: boolean | null
          total_orders?: number | null
          total_spent?: number | null
          trust_level?: string | null
          user_id?: string
          user_id_code?: string | null
          verification_approved_at?: string | null
          verification_rejected_at?: string | null
          verification_rejection_reason?: string | null
          verification_submitted_at?: string | null
          weekly_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_limits: {
        Row: {
          concentrate_grams: number | null
          created_at: string | null
          date: string
          flower_grams: number | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          concentrate_grams?: number | null
          created_at?: string | null
          date: string
          flower_grams?: number | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          concentrate_grams?: number | null
          created_at?: string | null
          date?: string
          flower_grams?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_name: string
          purchase_order_id: string
          quantity: number
          received_quantity: number | null
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number | null
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number | null
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          account_id: string
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          location_id: string | null
          notes: string | null
          po_number: string
          received_date: string | null
          shipping: number | null
          status: string | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          account_id: string
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          po_number: string
          received_date?: string | null
          shipping?: number | null
          status?: string | null
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          account_id?: string
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          po_number?: string
          received_date?: string | null
          shipping?: number | null
          status?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_control_tests: {
        Row: {
          batch_id: string | null
          coa_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          lab_name: string | null
          notes: string | null
          product_id: string | null
          status: string | null
          tenant_id: string
          test_date: string
          test_results: Json | null
          test_type: string
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          coa_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lab_name?: string | null
          notes?: string | null
          product_id?: string | null
          status?: string | null
          tenant_id: string
          test_date: string
          test_results?: Json | null
          test_type: string
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          coa_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lab_name?: string | null
          notes?: string | null
          product_id?: string | null
          status?: string | null
          tenant_id?: string
          test_date?: string
          test_results?: Json | null
          test_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_control_tests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_control_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quarantined_inventory: {
        Row: {
          batch_id: string
          created_at: string | null
          created_by: string | null
          id: string
          product_id: string | null
          quantity_lbs: number
          reason: string
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id?: string | null
          quantity_lbs: number
          reason: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id?: string | null
          quantity_lbs?: number
          reason?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quarantined_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarantined_inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_notifications: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          notification_type: string | null
          recall_id: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notification_type?: string | null
          recall_id: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notification_type?: string | null
          recall_id?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recall_notifications_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "batch_recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_records: {
        Row: {
          created_at: string | null
          damaged_items: number | null
          expected_items: number | null
          id: string
          missing_items: number | null
          notes: string | null
          qc_status: string | null
          received_date: string | null
          received_items: number | null
          shipment_number: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          vendor: string
        }
        Insert: {
          created_at?: string | null
          damaged_items?: number | null
          expected_items?: number | null
          id?: string
          missing_items?: number | null
          notes?: string | null
          qc_status?: string | null
          received_date?: string | null
          received_items?: number | null
          shipment_number: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          vendor: string
        }
        Update: {
          created_at?: string | null
          damaged_items?: number | null
          expected_items?: number | null
          id?: string
          missing_items?: number | null
          notes?: string | null
          qc_status?: string | null
          received_date?: string | null
          received_items?: number | null
          shipment_number?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_purchases: {
        Row: {
          created_at: string | null
          customer_name: string
          id: string
          location: string
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          id?: string
          location: string
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          id?: string
          location?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recent_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_schedules: {
        Row: {
          auto_send_email: boolean | null
          client_id: string
          created_at: string | null
          day_of_month: number | null
          frequency: string
          id: string
          is_active: boolean | null
          last_run_date: string | null
          line_items: Json
          name: string
          next_run_date: string
          notes: string | null
          template_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auto_send_email?: boolean | null
          client_id: string
          created_at?: string | null
          day_of_month?: number | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_run_date?: string | null
          line_items?: Json
          name: string
          next_run_date: string
          notes?: string | null
          template_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auto_send_email?: boolean | null
          client_id?: string
          created_at?: string | null
          day_of_month?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_date?: string | null
          line_items?: Json
          name?: string
          next_run_date?: string
          notes?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_daily_stats: {
        Row: {
          created_at: string | null
          date: string
          id: string
          total_clicks: number | null
          total_conversions: number | null
          total_rewards_earned: number | null
          total_signups: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          total_clicks?: number | null
          total_conversions?: number | null
          total_rewards_earned?: number | null
          total_signups?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          total_clicks?: number | null
          total_conversions?: number | null
          total_rewards_earned?: number | null
          total_signups?: number | null
          user_id?: string
        }
        Relationships: []
      }
      report_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          executed_by: string | null
          execution_type: string
          id: string
          report_id: string
          result_count: number | null
          result_data: Json | null
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          executed_by?: string | null
          execution_type?: string
          id?: string
          report_id: string
          result_count?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          executed_by?: string | null
          execution_type?: string
          id?: string
          report_id?: string
          result_count?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_executions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "custom_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          content: string
          created_at: string | null
          id: string
          responder_id: string
          responder_name: string
          review_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          responder_id: string
          responder_name: string
          review_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          responder_id?: string
          responder_name?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          order_id: string | null
          photo_urls: string[] | null
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          photo_urls?: string[] | null
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          photo_urls?: string[] | null
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          account_id: string
          customer_id: string
          id: string
          order_id: string | null
          points_used: number
          redeemed_at: string | null
          reward_id: string
        }
        Insert: {
          account_id: string
          customer_id: string
          id?: string
          order_id?: string | null
          points_used: number
          redeemed_at?: string | null
          reward_id: string
        }
        Update: {
          account_id?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          points_used?: number
          redeemed_at?: string | null
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_factors: {
        Row: {
          avg_income: number | null
          borough: string
          crime_rate: number | null
          delivery_issues: number | null
          id: string
          neighborhood: string
          risk_level: number
          scam_reports: number | null
          updated_at: string | null
        }
        Insert: {
          avg_income?: number | null
          borough: string
          crime_rate?: number | null
          delivery_issues?: number | null
          id?: string
          neighborhood: string
          risk_level?: number
          scam_reports?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_income?: number | null
          borough?: string
          crime_rate?: number | null
          delivery_issues?: number | null
          id?: string
          neighborhood?: string
          risk_level?: number
          scam_reports?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          permissions: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_location_history: {
        Row: {
          accuracy: number | null
          altitude: number | null
          battery_level: number | null
          created_at: string
          delivery_id: string | null
          heading: number | null
          id: string
          is_moving: boolean | null
          latitude: number
          longitude: number
          recorded_at: string
          runner_id: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          battery_level?: number | null
          created_at?: string
          delivery_id?: string | null
          heading?: number | null
          id?: string
          is_moving?: boolean | null
          latitude: number
          longitude: number
          recorded_at?: string
          runner_id: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          battery_level?: number | null
          created_at?: string
          delivery_id?: string | null
          heading?: number | null
          id?: string
          is_moving?: boolean | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          runner_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "runner_location_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "runner_earnings_view"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "runner_location_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "wholesale_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_location_history_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "wholesale_runners"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          last_run_at: string | null
          next_run_at: string | null
          recipients: string[] | null
          report_id: string
          schedule_config: Json | null
          schedule_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[] | null
          report_id: string
          schedule_config?: Json | null
          schedule_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[] | null
          report_id?: string
          schedule_config?: Json | null
          schedule_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "custom_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sidebar_preferences: {
        Row: {
          collapsed_sections: string[] | null
          created_at: string | null
          custom_layout: boolean | null
          custom_menu_items: Json | null
          custom_presets: Json | null
          custom_sections: Json | null
          enabled_integrations: string[] | null
          favorites: string[] | null
          hidden_features: string[] | null
          id: string
          last_accessed_features: Json | null
          layout_preset: string | null
          operation_size: string | null
          pinned_items: string[] | null
          section_order: string[] | null
          sidebar_behavior: Json | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          collapsed_sections?: string[] | null
          created_at?: string | null
          custom_layout?: boolean | null
          custom_menu_items?: Json | null
          custom_presets?: Json | null
          custom_sections?: Json | null
          enabled_integrations?: string[] | null
          favorites?: string[] | null
          hidden_features?: string[] | null
          id?: string
          last_accessed_features?: Json | null
          layout_preset?: string | null
          operation_size?: string | null
          pinned_items?: string[] | null
          section_order?: string[] | null
          sidebar_behavior?: Json | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          collapsed_sections?: string[] | null
          created_at?: string | null
          custom_layout?: boolean | null
          custom_menu_items?: Json | null
          custom_presets?: Json | null
          custom_sections?: Json | null
          enabled_integrations?: string[] | null
          favorites?: string[] | null
          hidden_features?: string[] | null
          id?: string
          last_accessed_features?: Json | null
          layout_preset?: string | null
          operation_size?: string | null
          pinned_items?: string[] | null
          section_order?: string[] | null
          sidebar_behavior?: Json | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_analytics: {
        Row: {
          created_at: string | null
          customer_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          product_id: string | null
          session_id: string | null
          store_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          session_id?: string | null
          store_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          session_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          stripe_event_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string | null
          features: Json | null
          id: string
          is_active: boolean
          limits: Json | null
          name: string
          price: number
          price_monthly: number | null
          price_yearly: number | null
          slug: string | null
          sort_order: number | null
          stripe_price_id: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          limits?: Json | null
          name: string
          price: number
          price_monthly?: number | null
          price_yearly?: number | null
          slug?: string | null
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          limits?: Json | null
          name?: string
          price?: number
          price_monthly?: number | null
          price_yearly?: number | null
          slug?: string | null
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          account_id: string
          cancel_at: string | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          metadata: Json | null
          plan_id: string
          status: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          super_admin_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          super_admin_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          super_admin_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_audit_logs_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "super_admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          super_admin_id: string
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          super_admin_id: string
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          super_admin_id?: string
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_sessions_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "super_admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_users: {
        Row: {
          clerk_user_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          last_name: string | null
          password_hash: string
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clerk_user_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          last_name?: string | null
          password_hash: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          last_name?: string | null
          password_hash?: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_number: string | null
          supplier_id: string | null
          transaction_date: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_number?: string | null
          supplier_id?: string | null
          transaction_date?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_number?: string | null
          supplier_id?: string | null
          transaction_date?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "wholesale_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_comments: {
        Row: {
          attachments: Json | null
          comment: string
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          comment: string
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          comment?: string
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          account_id: string
          assigned_to: string | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string
          tenant_id: string | null
          ticket_number: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject: string
          tenant_id?: string | null
          ticket_number: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string
          tenant_id?: string | null
          ticket_number?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suspicious_login_alerts: {
        Row: {
          account_secured: boolean | null
          alert_type: string
          browser: string | null
          created_at: string
          device_fingerprint: string
          device_type: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          geo_city: string | null
          geo_country: string | null
          id: string
          ip_address: string | null
          os: string | null
          responded_at: string | null
          secure_token: string | null
          severity: string | null
          status: string | null
          user_id: string
          user_response: string | null
        }
        Insert: {
          account_secured?: boolean | null
          alert_type: string
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          device_type?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          ip_address?: string | null
          os?: string | null
          responded_at?: string | null
          secure_token?: string | null
          severity?: string | null
          status?: string | null
          user_id: string
          user_response?: string | null
        }
        Update: {
          account_secured?: boolean | null
          alert_type?: string
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          device_type?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          ip_address?: string | null
          os?: string | null
          responded_at?: string | null
          secure_token?: string | null
          severity?: string | null
          status?: string | null
          user_id?: string
          user_response?: string | null
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          timestamp: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          timestamp?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          timestamp?: string | null
          value?: number
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          applies_to: string[] | null
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string
          rate: number
          tax_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          applies_to?: string[] | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rate: number
          tax_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          applies_to?: string[] | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rate?: number
          tax_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_credits: {
        Row: {
          alerts_sent: Json | null
          balance: number
          created_at: string | null
          credits_used_today: number | null
          free_credits_balance: number | null
          free_credits_expires_at: string | null
          id: string
          is_free_tier: boolean | null
          last_free_grant_at: string | null
          last_refill_at: string | null
          lifetime_earned: number
          lifetime_spent: number
          next_free_grant_at: string | null
          next_refill_at: string | null
          purchased_credits_balance: number | null
          rollover_enabled: boolean | null
          tenant_id: string
          updated_at: string | null
          warning_0_sent: boolean | null
          warning_10_sent: boolean | null
          warning_25_sent: boolean | null
          warning_5_sent: boolean | null
        }
        Insert: {
          alerts_sent?: Json | null
          balance?: number
          created_at?: string | null
          credits_used_today?: number | null
          free_credits_balance?: number | null
          free_credits_expires_at?: string | null
          id?: string
          is_free_tier?: boolean | null
          last_free_grant_at?: string | null
          last_refill_at?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          next_free_grant_at?: string | null
          next_refill_at?: string | null
          purchased_credits_balance?: number | null
          rollover_enabled?: boolean | null
          tenant_id: string
          updated_at?: string | null
          warning_0_sent?: boolean | null
          warning_10_sent?: boolean | null
          warning_25_sent?: boolean | null
          warning_5_sent?: boolean | null
        }
        Update: {
          alerts_sent?: Json | null
          balance?: number
          created_at?: string | null
          credits_used_today?: number | null
          free_credits_balance?: number | null
          free_credits_expires_at?: string | null
          id?: string
          is_free_tier?: boolean | null
          last_free_grant_at?: string | null
          last_refill_at?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          next_free_grant_at?: string | null
          next_refill_at?: string | null
          purchased_credits_balance?: number | null
          rollover_enabled?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          warning_0_sent?: boolean | null
          warning_10_sent?: boolean | null
          warning_25_sent?: boolean | null
          warning_5_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          tenant_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: string
          status?: string
          tenant_id: string
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_settings: {
        Row: {
          accept_bitcoin: boolean | null
          accept_cash: boolean | null
          accept_cashapp: boolean | null
          accept_ethereum: boolean | null
          accept_lightning: boolean | null
          accept_usdt: boolean | null
          accept_zelle: boolean | null
          bitcoin_address: string | null
          cash_instructions: string | null
          cashapp_instructions: string | null
          cashapp_username: string | null
          created_at: string | null
          crypto_instructions: string | null
          ethereum_address: string | null
          id: string
          lightning_address: string | null
          tenant_id: string
          updated_at: string | null
          usdt_address: string | null
          zelle_instructions: string | null
          zelle_phone: string | null
          zelle_username: string | null
        }
        Insert: {
          accept_bitcoin?: boolean | null
          accept_cash?: boolean | null
          accept_cashapp?: boolean | null
          accept_ethereum?: boolean | null
          accept_lightning?: boolean | null
          accept_usdt?: boolean | null
          accept_zelle?: boolean | null
          bitcoin_address?: string | null
          cash_instructions?: string | null
          cashapp_instructions?: string | null
          cashapp_username?: string | null
          created_at?: string | null
          crypto_instructions?: string | null
          ethereum_address?: string | null
          id?: string
          lightning_address?: string | null
          tenant_id: string
          updated_at?: string | null
          usdt_address?: string | null
          zelle_instructions?: string | null
          zelle_phone?: string | null
          zelle_username?: string | null
        }
        Update: {
          accept_bitcoin?: boolean | null
          accept_cash?: boolean | null
          accept_cashapp?: boolean | null
          accept_ethereum?: boolean | null
          accept_lightning?: boolean | null
          accept_usdt?: boolean | null
          accept_zelle?: boolean | null
          bitcoin_address?: string | null
          cash_instructions?: string | null
          cashapp_instructions?: string | null
          cashapp_username?: string | null
          created_at?: string | null
          crypto_instructions?: string | null
          ethereum_address?: string | null
          id?: string
          lightning_address?: string | null
          tenant_id?: string
          updated_at?: string | null
          usdt_address?: string | null
          zelle_instructions?: string | null
          zelle_phone?: string | null
          zelle_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          role_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          role_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          accepted_at: string | null
          avatar_url: string | null
          clerk_user_id: string | null
          created_at: string | null
          email: string
          email_verification_sent_at: string | null
          email_verification_token_expires_at: string | null
          email_verified: boolean | null
          first_name: string | null
          id: string
          invited_at: string | null
          last_login_at: string | null
          name: string
          role: string
          status: string
          tenant_id: string
          updated_at: string | null
          user_id: string | null
          verification_reminder_sent: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          avatar_url?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          email: string
          email_verification_sent_at?: string | null
          email_verification_token_expires_at?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          name: string
          role: string
          status?: string
          tenant_id: string
          updated_at?: string | null
          user_id?: string | null
          verification_reminder_sent?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          avatar_url?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string
          email_verification_sent_at?: string | null
          email_verification_token_expires_at?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          name?: string
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
          verification_reminder_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_cycle: string | null
          business_name: string
          business_tier: string | null
          cancellation_completed_at: string | null
          cancellation_reason: string | null
          cancellation_requested_at: string | null
          cancellation_requested_by: string | null
          cancelled_at: string | null
          company_size: string | null
          compliance_verified: boolean | null
          created_at: string | null
          credits_enabled: boolean | null
          demo_data_generated: boolean | null
          detected_operation_size: string | null
          feature_toggles: Json | null
          features: Json | null
          grace_period_ends_at: string | null
          id: string
          industry: string | null
          is_free_tier: boolean | null
          last_activity_at: string | null
          last_size_detection_at: string | null
          limits: Json | null
          monthly_orders: number | null
          monthly_revenue: number | null
          mrr: number | null
          onboarded: boolean | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_skipped: boolean | null
          owner_email: string
          owner_name: string
          payment_method_added: boolean | null
          phone: string | null
          slug: string
          state: string | null
          state_licenses: Json | null
          status: string | null
          stripe_customer_id: string | null
          subscription_plan: string
          subscription_status: string
          suspended_reason: string | null
          team_size: number | null
          tier_detected_at: string | null
          tier_override: boolean | null
          timezone: string | null
          trial_cancelled_at: string | null
          trial_converted_at: string | null
          trial_days: number | null
          trial_ends_at: string | null
          trial_reminder_12_sent: boolean | null
          trial_reminder_13_sent: boolean | null
          trial_reminder_14_sent: boolean | null
          trial_started_at: string | null
          updated_at: string | null
          usage: Json | null
          white_label: Json | null
        }
        Insert: {
          billing_cycle?: string | null
          business_name: string
          business_tier?: string | null
          cancellation_completed_at?: string | null
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          cancellation_requested_by?: string | null
          cancelled_at?: string | null
          company_size?: string | null
          compliance_verified?: boolean | null
          created_at?: string | null
          credits_enabled?: boolean | null
          demo_data_generated?: boolean | null
          detected_operation_size?: string | null
          feature_toggles?: Json | null
          features?: Json | null
          grace_period_ends_at?: string | null
          id?: string
          industry?: string | null
          is_free_tier?: boolean | null
          last_activity_at?: string | null
          last_size_detection_at?: string | null
          limits?: Json | null
          monthly_orders?: number | null
          monthly_revenue?: number | null
          mrr?: number | null
          onboarded?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_skipped?: boolean | null
          owner_email: string
          owner_name: string
          payment_method_added?: boolean | null
          phone?: string | null
          slug: string
          state?: string | null
          state_licenses?: Json | null
          status?: string | null
          stripe_customer_id?: string | null
          subscription_plan: string
          subscription_status: string
          suspended_reason?: string | null
          team_size?: number | null
          tier_detected_at?: string | null
          tier_override?: boolean | null
          timezone?: string | null
          trial_cancelled_at?: string | null
          trial_converted_at?: string | null
          trial_days?: number | null
          trial_ends_at?: string | null
          trial_reminder_12_sent?: boolean | null
          trial_reminder_13_sent?: boolean | null
          trial_reminder_14_sent?: boolean | null
          trial_started_at?: string | null
          updated_at?: string | null
          usage?: Json | null
          white_label?: Json | null
        }
        Update: {
          billing_cycle?: string | null
          business_name?: string
          business_tier?: string | null
          cancellation_completed_at?: string | null
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          cancellation_requested_by?: string | null
          cancelled_at?: string | null
          company_size?: string | null
          compliance_verified?: boolean | null
          created_at?: string | null
          credits_enabled?: boolean | null
          demo_data_generated?: boolean | null
          detected_operation_size?: string | null
          feature_toggles?: Json | null
          features?: Json | null
          grace_period_ends_at?: string | null
          id?: string
          industry?: string | null
          is_free_tier?: boolean | null
          last_activity_at?: string | null
          last_size_detection_at?: string | null
          limits?: Json | null
          monthly_orders?: number | null
          monthly_revenue?: number | null
          mrr?: number | null
          onboarded?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_skipped?: boolean | null
          owner_email?: string
          owner_name?: string
          payment_method_added?: boolean | null
          phone?: string | null
          slug?: string
          state?: string | null
          state_licenses?: Json | null
          status?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: string
          subscription_status?: string
          suspended_reason?: string | null
          team_size?: number | null
          tier_detected_at?: string | null
          tier_override?: boolean | null
          timezone?: string | null
          trial_cancelled_at?: string | null
          trial_converted_at?: string | null
          trial_days?: number | null
          trial_ends_at?: string | null
          trial_reminder_12_sent?: boolean | null
          trial_reminder_13_sent?: boolean | null
          trial_reminder_14_sent?: boolean | null
          trial_started_at?: string | null
          updated_at?: string | null
          usage?: Json | null
          white_label?: Json | null
        }
        Relationships: []
      }
      trial_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_order_items: {
        Row: {
          discount_amount: number
          id: string
          inventory_id: string | null
          metadata: Json | null
          order_id: string
          price_at_order_time: number | null
          product_id: string | null
          product_name: string
          quantity: number
          quantity_unit: string
          sku: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          discount_amount?: number
          id?: string
          inventory_id?: string | null
          metadata?: Json | null
          order_id: string
          price_at_order_time?: number | null
          product_id?: string | null
          product_name: string
          quantity: number
          quantity_unit?: string
          sku?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          discount_amount?: number
          id?: string
          inventory_id?: string | null
          metadata?: Json | null
          order_id?: string
          price_at_order_time?: number | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          quantity_unit?: string
          sku?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "unified_order_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "wholesale_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "menu_orders_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "retail_orders_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "unified_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_name: string | null
          contact_phone: string | null
          courier_id: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_notes: string | null
          discount_amount: number
          id: string
          menu_id: string | null
          metadata: Json | null
          order_number: string
          order_type: string
          orphaned_at: string | null
          payment_method: string | null
          payment_status: string
          shift_id: string | null
          source: string
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          version: number | null
          wholesale_client_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number
          id?: string
          menu_id?: string | null
          metadata?: Json | null
          order_number: string
          order_type: string
          orphaned_at?: string | null
          payment_method?: string | null
          payment_status?: string
          shift_id?: string | null
          source: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total_amount: number
          updated_at?: string
          version?: number | null
          wholesale_client_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number
          id?: string
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string
          order_type?: string
          orphaned_at?: string | null
          payment_method?: string | null
          payment_status?: string
          shift_id?: string | null
          source?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          version?: number | null
          wholesale_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "unified_orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_wholesale_client_id_fkey"
            columns: ["wholesale_client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          quantity: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      user_backup_codes: {
        Row: {
          code_hash: string
          created_at: string | null
          id: string
          tenant_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string | null
          id?: string
          tenant_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string | null
          id?: string
          tenant_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_backup_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ip_addresses: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          first_seen: string | null
          id: string
          ip_address: string
          is_blocked: boolean | null
          last_seen: string | null
          times_used: number | null
          user_id: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          first_seen?: string | null
          id?: string
          ip_address: string
          is_blocked?: boolean | null
          last_seen?: string | null
          times_used?: number | null
          user_id: string
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          first_seen?: string | null
          id?: string
          ip_address?: string
          is_blocked?: boolean | null
          last_seen?: string | null
          times_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_known_devices: {
        Row: {
          browser: string | null
          device_fingerprint: string
          device_name: string | null
          device_type: string | null
          first_seen_at: string
          geo_city: string | null
          geo_country: string | null
          id: string
          ip_address: string | null
          is_trusted: boolean | null
          last_seen_at: string
          os: string | null
          trust_confirmed_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          device_fingerprint: string
          device_name?: string | null
          device_type?: string | null
          first_seen_at?: string
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          ip_address?: string | null
          is_trusted?: boolean | null
          last_seen_at?: string
          os?: string | null
          trust_confirmed_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          device_fingerprint?: string
          device_name?: string | null
          device_type?: string | null
          first_seen_at?: string
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          ip_address?: string | null
          is_trusted?: boolean | null
          last_seen_at?: string
          os?: string | null
          trust_confirmed_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_reputation: {
        Row: {
          comment_karma: number
          comments_created: number
          post_karma: number
          posts_created: number
          total_karma: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_karma?: number
          comments_created?: number
          post_karma?: number
          posts_created?: number
          total_karma?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_karma?: number
          comments_created?: number
          post_karma?: number
          posts_created?: number
          total_karma?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reputation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "forum_user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_welcome_discounts: {
        Row: {
          code: string | null
          discount_percentage: number | null
          expires_at: string | null
          id: string
          issued_at: string | null
          order_id: string | null
          used: boolean | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          code?: string | null
          discount_percentage?: number | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          order_id?: string | null
          used?: boolean | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string | null
          discount_percentage?: number | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          order_id?: string | null
          used?: boolean | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          account_id: string
          address: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          license_number: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          state: string | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          license_number?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          state?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          license_number?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          state?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          id: string
          manager_id: string | null
          name: string
          state: string | null
          tenant_id: string
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          state?: string | null
          tenant_id: string
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          state?: string | null
          tenant_id?: string
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          events: Json | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          secret: string | null
          tenant_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          events?: Json | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          tenant_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          events?: Json | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          tenant_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      wholesale_client_notes: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_internal: boolean | null
          note: string
          note_type: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          note: string
          note_type?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          note?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_clients: {
        Row: {
          address: string
          business_name: string
          client_type: string
          contact_name: string
          coordinates: Json | null
          created_at: string
          credit_limit: number
          deleted_at: string | null
          email: string
          id: string
          is_tax_exempt: boolean | null
          last_order_date: string | null
          last_payment_date: string | null
          license_alerts_sent: Json | null
          license_expiration_date: string | null
          license_status: string | null
          monthly_volume: number
          notes: string | null
          outstanding_balance: number
          payment_terms: number
          phone: string
          portal_token: string | null
          reliability_score: number
          status: string
          tax_exempt_certificate: string | null
          tenant_id: string
          updated_at: string
          version: number | null
        }
        Insert: {
          address: string
          business_name: string
          client_type: string
          contact_name: string
          coordinates?: Json | null
          created_at?: string
          credit_limit?: number
          deleted_at?: string | null
          email: string
          id?: string
          is_tax_exempt?: boolean | null
          last_order_date?: string | null
          last_payment_date?: string | null
          license_alerts_sent?: Json | null
          license_expiration_date?: string | null
          license_status?: string | null
          monthly_volume?: number
          notes?: string | null
          outstanding_balance?: number
          payment_terms?: number
          phone: string
          portal_token?: string | null
          reliability_score?: number
          status?: string
          tax_exempt_certificate?: string | null
          tenant_id: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          address?: string
          business_name?: string
          client_type?: string
          contact_name?: string
          coordinates?: Json | null
          created_at?: string
          credit_limit?: number
          deleted_at?: string | null
          email?: string
          id?: string
          is_tax_exempt?: boolean | null
          last_order_date?: string | null
          last_payment_date?: string | null
          license_alerts_sent?: Json | null
          license_expiration_date?: string | null
          license_status?: string | null
          monthly_volume?: number
          notes?: string | null
          outstanding_balance?: number
          payment_terms?: number
          phone?: string
          portal_token?: string | null
          reliability_score?: number
          status?: string
          tax_exempt_certificate?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_wholesale_clients_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_deliveries: {
        Row: {
          assigned_at: string
          client_id: string | null
          collection_amount: number | null
          created_at: string
          current_location: Json | null
          delivered_at: string | null
          failed_at: string | null
          id: string
          notes: string | null
          order_id: string
          picked_up_at: string | null
          runner_id: string
          scheduled_pickup_time: string | null
          status: string
          tenant_id: string
          total_value: number | null
          total_weight: number | null
        }
        Insert: {
          assigned_at?: string
          client_id?: string | null
          collection_amount?: number | null
          created_at?: string
          current_location?: Json | null
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          picked_up_at?: string | null
          runner_id: string
          scheduled_pickup_time?: string | null
          status?: string
          tenant_id: string
          total_value?: number | null
          total_weight?: number | null
        }
        Update: {
          assigned_at?: string
          client_id?: string | null
          collection_amount?: number | null
          created_at?: string
          current_location?: Json | null
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          picked_up_at?: string | null
          runner_id?: string
          scheduled_pickup_time?: string | null
          status?: string
          tenant_id?: string
          total_value?: number | null
          total_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_wholesale_deliveries_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_deliveries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_deliveries_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "wholesale_runners"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_inventory: {
        Row: {
          base_price: number | null
          category: string
          cbd_percentage: number | null
          cost_per_lb: number | null
          created_at: string
          description: string | null
          effects: Json | null
          flavors: Json | null
          grow_info: string | null
          id: string
          image_url: string | null
          images: string[] | null
          last_restock_date: string | null
          lineage: string | null
          prices: Json | null
          product_name: string
          quantity_lbs: number
          quantity_units: number
          reorder_point: number
          strain_type: string | null
          tenant_id: string
          terpenes: Json | null
          thc_percentage: number | null
          updated_at: string
          warehouse_location: string
        }
        Insert: {
          base_price?: number | null
          category: string
          cbd_percentage?: number | null
          cost_per_lb?: number | null
          created_at?: string
          description?: string | null
          effects?: Json | null
          flavors?: Json | null
          grow_info?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          last_restock_date?: string | null
          lineage?: string | null
          prices?: Json | null
          product_name: string
          quantity_lbs?: number
          quantity_units?: number
          reorder_point?: number
          strain_type?: string | null
          tenant_id: string
          terpenes?: Json | null
          thc_percentage?: number | null
          updated_at?: string
          warehouse_location?: string
        }
        Update: {
          base_price?: number | null
          category?: string
          cbd_percentage?: number | null
          cost_per_lb?: number | null
          created_at?: string
          description?: string | null
          effects?: Json | null
          flavors?: Json | null
          grow_info?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          last_restock_date?: string | null
          lineage?: string | null
          prices?: Json | null
          product_name?: string
          quantity_lbs?: number
          quantity_units?: number
          reorder_point?: number
          strain_type?: string | null
          tenant_id?: string
          terpenes?: Json | null
          thc_percentage?: number | null
          updated_at?: string
          warehouse_location?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wholesale_inventory_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_inventory_movements: {
        Row: {
          created_at: string | null
          from_location: string | null
          id: string
          inventory_id: string | null
          movement_type: string
          notes: string | null
          order_id: string | null
          performed_by: string | null
          product_name: string
          quantity_change: number
          to_location: string | null
        }
        Insert: {
          created_at?: string | null
          from_location?: string | null
          id?: string
          inventory_id?: string | null
          movement_type: string
          notes?: string | null
          order_id?: string | null
          performed_by?: string | null
          product_name: string
          quantity_change: number
          to_location?: string | null
        }
        Update: {
          created_at?: string | null
          from_location?: string | null
          id?: string
          inventory_id?: string | null
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          performed_by?: string | null
          product_name?: string
          quantity_change?: number
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "wholesale_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_inventory_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          from_location: string
          id: string
          inventory_id: string
          quantity_lbs: number
          quantity_units: number
          runner_id: string | null
          status: string
          to_location: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          from_location: string
          id?: string
          inventory_id: string
          quantity_lbs: number
          quantity_units: number
          runner_id?: string | null
          status?: string
          to_location?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          from_location?: string
          id?: string
          inventory_id?: string
          quantity_lbs?: number
          quantity_units?: number
          runner_id?: string | null
          status?: string
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_inventory_transfers_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "wholesale_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_inventory_transfers_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "wholesale_runners"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_orders: {
        Row: {
          assigned_at: string | null
          cancelled_at: string | null
          client_id: string
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string
          delivery_notes: string | null
          id: string
          order_number: string
          orphaned_at: string | null
          payment_due_date: string | null
          payment_status: string
          runner_id: string | null
          shipped_at: string | null
          status: string
          tenant_id: string
          total_amount: number
          version: number | null
        }
        Insert: {
          assigned_at?: string | null
          cancelled_at?: string | null
          client_id: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address: string
          delivery_notes?: string | null
          id?: string
          order_number: string
          orphaned_at?: string | null
          payment_due_date?: string | null
          payment_status?: string
          runner_id?: string | null
          shipped_at?: string | null
          status?: string
          tenant_id: string
          total_amount: number
          version?: number | null
        }
        Update: {
          assigned_at?: string | null
          cancelled_at?: string | null
          client_id?: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_notes?: string | null
          id?: string
          order_number?: string
          orphaned_at?: string | null
          payment_due_date?: string | null
          payment_status?: string
          runner_id?: string | null
          shipped_at?: string | null
          status?: string
          tenant_id?: string
          total_amount?: number
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_wholesale_orders_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "wholesale_runners"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string
          reference_number: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string
          reference_number?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string
          reference_number?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_runners: {
        Row: {
          admin_pin: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          current_location: Json | null
          email: string | null
          full_name: string
          id: string
          phone: string
          rating: number | null
          status: string
          tenant_id: string | null
          total_deliveries: number
          updated_at: string
          user_id: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          admin_pin?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          current_location?: Json | null
          email?: string | null
          full_name: string
          id?: string
          phone: string
          rating?: number | null
          status?: string
          tenant_id?: string | null
          total_deliveries?: number
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type: string
        }
        Update: {
          admin_pin?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          current_location?: Json | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          rating?: number | null
          status?: string
          tenant_id?: string | null
          total_deliveries?: number
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_runners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          payment_terms: string | null
          phone: string | null
          supplier_name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          payment_terms?: string | null
          phone?: string | null
          supplier_name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          payment_terms?: string | null
          phone?: string | null
          supplier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      workflow_action_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          edge_function_name: string | null
          icon: string | null
          id: string
          input_schema: Json
          is_system: boolean | null
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          edge_function_name?: string | null
          icon?: string | null
          id?: string
          input_schema?: Json
          is_system?: boolean | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          edge_function_name?: string | null
          icon?: string | null
          id?: string
          input_schema?: Json
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      workflow_dead_letter_queue: {
        Row: {
          created_at: string | null
          error_details: Json | null
          error_message: string
          error_stack: string | null
          error_type: string
          execution_log: Json | null
          first_failed_at: string
          id: string
          last_attempt_at: string
          manual_retry_requested: boolean | null
          manual_retry_requested_at: string | null
          manual_retry_requested_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          tenant_id: string | null
          total_attempts: number | null
          trigger_data: Json | null
          updated_at: string | null
          workflow_execution_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          error_message: string
          error_stack?: string | null
          error_type: string
          execution_log?: Json | null
          first_failed_at?: string
          id?: string
          last_attempt_at?: string
          manual_retry_requested?: boolean | null
          manual_retry_requested_at?: string | null
          manual_retry_requested_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          tenant_id?: string | null
          total_attempts?: number | null
          trigger_data?: Json | null
          updated_at?: string | null
          workflow_execution_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          execution_log?: Json | null
          first_failed_at?: string
          id?: string
          last_attempt_at?: string
          manual_retry_requested?: boolean | null
          manual_retry_requested_at?: string | null
          manual_retry_requested_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          tenant_id?: string | null
          total_attempts?: number | null
          trigger_data?: Json | null
          updated_at?: string | null
          workflow_execution_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_dead_letter_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_dead_letter_queue_workflow_execution_id_fkey"
            columns: ["workflow_execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_dead_letter_queue_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          actions: Json
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          retry_config: Json | null
          run_count: number | null
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          retry_config?: Json | null
          run_count?: number | null
          tenant_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          retry_config?: Json | null
          run_count?: number | null
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          execution_log: Json | null
          id: string
          is_retryable: boolean | null
          last_error: string | null
          next_retry_at: string | null
          retry_count: number | null
          started_at: string
          status: string
          tenant_id: string
          trigger_data: Json | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          is_retryable?: boolean | null
          last_error?: string | null
          next_retry_at?: string | null
          retry_count?: number | null
          started_at?: string
          status: string
          tenant_id: string
          trigger_data?: Json | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          is_retryable?: boolean | null
          last_error?: string | null
          next_retry_at?: string | null
          retry_count?: number | null
          started_at?: string
          status?: string
          tenant_id?: string
          trigger_data?: Json | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_triggers: {
        Row: {
          conditions: Json | null
          created_at: string
          event_type: string
          id: string
          table_name: string
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          event_type: string
          id?: string
          table_name: string
          tenant_id: string
          workflow_id: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          table_name?: string
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_triggers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_triggers_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          actions: Json
          change_details: Json | null
          change_summary: string | null
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          restored_from_version: number | null
          tenant_id: string | null
          trigger_config: Json | null
          trigger_type: string
          version_number: number
          workflow_id: string
        }
        Insert: {
          actions?: Json
          change_details?: Json | null
          change_summary?: string | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          restored_from_version?: number | null
          tenant_id?: string | null
          trigger_config?: Json | null
          trigger_type: string
          version_number: number
          workflow_id: string
        }
        Update: {
          actions?: Json
          change_details?: Json | null
          change_summary?: string | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          restored_from_version?: number | null
          tenant_id?: string | null
          trigger_config?: Json | null
          trigger_type?: string
          version_number?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      disposable_menu_products_decrypted: {
        Row: {
          created_at: string | null
          custom_price: number | null
          display_availability: boolean | null
          display_order: number | null
          id: string | null
          is_encrypted: boolean | null
          menu_id: string | null
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          custom_price?: never
          display_availability?: boolean | null
          display_order?: number | null
          id?: string | null
          is_encrypted?: boolean | null
          menu_id?: string | null
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          custom_price?: never
          display_availability?: boolean | null
          display_order?: number | null
          id?: string | null
          is_encrypted?: boolean | null
          menu_id?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disposable_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposable_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposable_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "disposable_menu_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "wholesale_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_menus_decrypted: {
        Row: {
          access_code_hash: string | null
          appearance_settings: Json | null
          burn_reason: string | null
          burned_at: string | null
          business_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          encrypted_url_token: string | null
          encryption_version: number | null
          expiration_date: string | null
          id: string | null
          is_encrypted: boolean | null
          max_order_quantity: number | null
          min_order_quantity: number | null
          name: string | null
          never_expires: boolean | null
          security_settings: Json | null
          status: Database["public"]["Enums"]["menu_status"] | null
          tenant_id: string | null
        }
        Insert: {
          access_code_hash?: string | null
          appearance_settings?: never
          burn_reason?: string | null
          burned_at?: string | null
          business_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: never
          encrypted_url_token?: string | null
          encryption_version?: number | null
          expiration_date?: string | null
          id?: string | null
          is_encrypted?: boolean | null
          max_order_quantity?: never
          min_order_quantity?: never
          name?: never
          never_expires?: boolean | null
          security_settings?: never
          status?: Database["public"]["Enums"]["menu_status"] | null
          tenant_id?: string | null
        }
        Update: {
          access_code_hash?: string | null
          appearance_settings?: never
          burn_reason?: string | null
          burned_at?: string | null
          business_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: never
          encrypted_url_token?: string | null
          encryption_version?: number | null
          expiration_date?: string | null
          id?: string | null
          is_encrypted?: boolean | null
          max_order_quantity?: never
          min_order_quantity?: never
          name?: never
          never_expires?: boolean | null
          security_settings?: never
          status?: Database["public"]["Enums"]["menu_status"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_disposable_menus_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_analytics_summary: {
        Row: {
          avg_order_value: number | null
          conversion_rate: number | null
          last_accessed_at: string | null
          menu_id: string | null
          order_count: number | null
          revenue: number | null
          tenant_id: string | null
          total_views: number | null
          unique_visitors: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_disposable_menus_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_orders_unified: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_name: string | null
          contact_phone: string | null
          courier_id: string | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_notes: string | null
          discount_amount: number | null
          id: string | null
          menu_id: string | null
          metadata: Json | null
          order_number: string | null
          order_type: string | null
          payment_method: string | null
          payment_status: string | null
          shift_id: string | null
          source: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string | null
          wholesale_client_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "unified_orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_wholesale_client_id_fkey"
            columns: ["wholesale_client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders_unified: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_name: string | null
          contact_phone: string | null
          courier_id: string | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_notes: string | null
          discount_amount: number | null
          id: string | null
          menu_id: string | null
          metadata: Json | null
          order_number: string | null
          order_type: string | null
          payment_method: string | null
          payment_status: string | null
          shift_id: string | null
          source: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string | null
          wholesale_client_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "unified_orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_wholesale_client_id_fkey"
            columns: ["wholesale_client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_orders_unified: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_name: string | null
          contact_phone: string | null
          courier_id: string | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_notes: string | null
          discount_amount: number | null
          id: string | null
          menu_id: string | null
          metadata: Json | null
          order_number: string | null
          order_type: string | null
          payment_method: string | null
          payment_status: string | null
          shift_id: string | null
          source: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string | null
          wholesale_client_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "unified_orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_wholesale_client_id_fkey"
            columns: ["wholesale_client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_earnings_view: {
        Row: {
          client_name: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_id: string | null
          order_id: string | null
          order_number: string | null
          order_total: number | null
          runner_id: string | null
          status: string | null
          total_earned: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_deliveries_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "wholesale_runners"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_orders: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: Json | null
          delivery_fee: number | null
          delivery_notes: string | null
          id: string | null
          items: Json | null
          order_number: string | null
          paid_at: string | null
          payment_status: string | null
          status: string | null
          store_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number | null
          tax_amount: number | null
          total: number | null
          tracking_token: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: never
          customer_id?: string | null
          customer_name?: never
          customer_phone?: never
          delivery_address?: Json | null
          delivery_fee?: never
          delivery_notes?: string | null
          id?: string | null
          items?: Json | null
          order_number?: string | null
          paid_at?: string | null
          payment_status?: string | null
          status?: string | null
          store_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          tax_amount?: never
          total?: number | null
          tracking_token?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: never
          customer_id?: string | null
          customer_name?: never
          customer_phone?: never
          delivery_address?: Json | null
          delivery_fee?: never
          delivery_notes?: string | null
          id?: string | null
          items?: Json | null
          order_number?: string | null
          paid_at?: string | null
          payment_status?: string | null
          status?: string | null
          store_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          tax_amount?: never
          total?: number | null
          tracking_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_orders_unified: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_name: string | null
          contact_phone: string | null
          courier_id: string | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_notes: string | null
          discount_amount: number | null
          id: string | null
          menu_id: string | null
          metadata: Json | null
          order_number: string | null
          order_type: string | null
          payment_method: string | null
          payment_status: string | null
          shift_id: string | null
          source: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string | null
          wholesale_client_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          discount_amount?: number | null
          id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shift_id?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          wholesale_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "disposable_menus_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_analytics_summary"
            referencedColumns: ["menu_id"]
          },
          {
            foreignKeyName: "unified_orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_orders_wholesale_client_id_fkey"
            columns: ["wholesale_client_id"]
            isOneToOne: false
            referencedRelation: "wholesale_clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_contact_type: {
        Args: { p_contact_id: string; p_contact_type: string }
        Returns: undefined
      }
      add_to_cart: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_selected_weight: string
          p_user_id: string
        }
        Returns: undefined
      }
      calculate_fraud_score: {
        Args: {
          p_device_fingerprint: string
          p_email: string
          p_ip_address: string
          p_phone: string
        }
        Returns: number
      }
      calculate_next_retry_delay: {
        Args: { p_retry_config: Json; p_retry_count: number }
        Returns: number
      }
      calculate_order_taxes: {
        Args: {
          p_category?: string
          p_subtotal: number
          p_tax_exempt?: boolean
          p_tenant_id: string
        }
        Returns: {
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_type: string
        }[]
      }
      calculate_risk_score: { Args: { p_user_id: string }; Returns: number }
      can_manage_tenant_accounts: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      cancel_reservation: {
        Args: { p_reason?: string; p_reservation_id: string }
        Returns: Json
      }
      check_credit_rate_limit: {
        Args: {
          p_max_operations?: number
          p_tenant_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_credits: {
        Args: { p_action_key: string; p_tenant_id: string }
        Returns: Json
      }
      check_device_suspicious_login: {
        Args: {
          p_browser?: string
          p_device_fingerprint: string
          p_device_type?: string
          p_geo_city?: string
          p_geo_country?: string
          p_ip_address?: string
          p_os?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
      check_is_admin: { Args: { _user_id: string }; Returns: boolean }
      check_platform_admin_access: { Args: never; Returns: Json }
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_limit: number
          p_tenant_id: string
          p_window_hours?: number
        }
        Returns: Json
      }
      check_tenant_subscription_valid: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      cleanup_expired_reservations: { Args: never; Returns: Json }
      cleanup_old_location_history: { Args: never; Returns: undefined }
      commit_reserved_inventory: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      compare_workflow_versions: {
        Args: {
          p_version_a: number
          p_version_b: number
          p_workflow_id: string
        }
        Returns: Json
      }
      complete_reservation: {
        Args: { p_order_id: string; p_session_id: string }
        Returns: Json
      }
      confirm_menu_order: {
        Args: {
          p_order_data: Json
          p_payment_info: Json
          p_reservation_id: string
          p_trace_id?: string
        }
        Returns: Json
      }
      consume_credits: {
        Args: {
          p_action_key: string
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_reference_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      create_courier_pin_session: {
        Args: { p_courier_id: string }
        Returns: string
      }
      create_giveaway_entry_safe: {
        Args: {
          p_borough: string
          p_device_fingerprint: string
          p_email: string
          p_entry_type?: string
          p_first_name: string
          p_giveaway_id: string
          p_instagram: string
          p_ip_address: string
          p_last_name: string
          p_order_id?: string
          p_phone: string
          p_user_agent: string
        }
        Returns: Json
      }
      create_marketplace_order: {
        Args: {
          p_customer_email: string
          p_customer_name: string
          p_customer_phone?: string
          p_delivery_address?: string
          p_delivery_fee?: number
          p_delivery_notes?: string
          p_items?: Json
          p_payment_method?: string
          p_store_id: string
          p_subtotal?: number
          p_tax?: number
          p_total?: number
        }
        Returns: string
      }
      create_pos_transaction_atomic: {
        Args: {
          p_customer_id?: string
          p_discount_amount?: number
          p_items: Json
          p_notes?: string
          p_payment_method: string
          p_payment_status?: string
          p_shift_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      create_super_admin_with_password: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_password: string
        }
        Returns: string
      }
      create_tenant_atomic: {
        Args: {
          p_auth_user_id: string
          p_business_name: string
          p_company_size?: string
          p_email: string
          p_industry?: string
          p_owner_name: string
          p_phone?: string
          p_slug?: string
          p_state?: string
        }
        Returns: Json
      }
      create_unified_order: {
        Args: {
          p_contact_name?: string
          p_contact_phone?: string
          p_courier_id?: string
          p_customer_id?: string
          p_delivery_address?: string
          p_delivery_notes?: string
          p_items: Json
          p_menu_id?: string
          p_metadata?: Json
          p_order_type: string
          p_payment_method?: string
          p_shift_id?: string
          p_source: string
          p_tenant_id: string
          p_wholesale_client_id?: string
        }
        Returns: string
      }
      decrement_giveaway_entries: {
        Args: { p_entries: number; p_giveaway_id: string; p_user_id: string }
        Returns: undefined
      }
      decrement_inventory: {
        Args: { _product_id: string; _quantity: number }
        Returns: boolean
      }
      decrement_listing_quantity: {
        Args: { p_listing_id: string; p_quantity: number }
        Returns: undefined
      }
      decrement_product_inventory: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      decrement_wholesale_inventory: {
        Args: {
          p_product_name: string
          p_quantity_lbs: number
          p_quantity_units: number
        }
        Returns: boolean
      }
      decrypt_menu_jsonb: { Args: { encrypted_data: string }; Returns: Json }
      decrypt_menu_numeric: {
        Args: { encrypted_data: string }
        Returns: number
      }
      decrypt_menu_text: { Args: { encrypted_data: string }; Returns: string }
      delete_product_image: {
        Args: { p_image_id: string; p_product_id: string }
        Returns: undefined
      }
      detect_operation_size: { Args: { p_tenant_id: string }; Returns: string }
      dismiss_inventory_alert: {
        Args: { p_alert_id: string }
        Returns: boolean
      }
      emergency_wipe: { Args: { tenant_id: string }; Returns: undefined }
      emergency_wipe_all_data: { Args: never; Returns: undefined }
      encrypt_disposable_menu: { Args: { menu_id: string }; Returns: boolean }
      encrypt_menu_jsonb: { Args: { plaintext: Json }; Returns: string }
      encrypt_menu_numeric: { Args: { plaintext: number }; Returns: string }
      encrypt_menu_text: { Args: { plaintext: string }; Returns: string }
      generate_admin_pin: { Args: never; Returns: string }
      generate_crm_invoice_number: {
        Args: { p_account_id: string }
        Returns: string
      }
      generate_crm_pre_order_number: {
        Args: { p_account_id: string }
        Returns: string
      }
      generate_entry_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_otp: { Args: never; Returns: string }
      generate_po_number: { Args: never; Returns: string }
      generate_pos_transaction_number: { Args: never; Returns: string }
      generate_product_slug: { Args: { p_name: string }; Returns: string }
      generate_shift_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      generate_tracking_code: { Args: never; Returns: string }
      generate_transfer_number: { Args: never; Returns: string }
      generate_user_id_code: {
        Args: { p_borough: string; p_user_id: string }
        Returns: string
      }
      generate_wholesale_order_number: { Args: never; Returns: string }
      get_admin_dashboard_metrics: { Args: never; Returns: Json }
      get_admin_orders: {
        Args: { limit_count?: number; offset_count?: number }
        Returns: {
          courier_name: string
          courier_phone: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_borough: string
          id: string
          merchant_name: string
          order_number: string
          status: string
          total_amount: number
        }[]
      }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_backup_codes_status: {
        Args: { p_user_id: string }
        Returns: {
          needs_regeneration: boolean
          total_codes: number
          unused_codes: number
          used_codes: number
        }[]
      }
      get_couriers_with_daily_earnings: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_online: boolean
          phone: string
          rating: number
          today_earnings: number
          total_deliveries: number
          vehicle_type: string
        }[]
      }
      get_marketplace_funnel: {
        Args: { p_store_id: string }
        Returns: {
          add_to_cart: number
          checkout_starts: number
          conversion_rate: number
          page_views: number
          product_views: number
          purchases: number
        }[]
      }
      get_marketplace_products: {
        Args: { p_store_id: string }
        Returns: {
          brand: string
          category: string
          cbd_content: number
          created_at: string
          description: string
          image_url: string
          images: string[]
          is_featured: boolean
          is_on_sale: boolean
          price: number
          product_id: string
          product_name: string
          sale_price: number
          sku: string
          sort_order: number
          stock_quantity: number
          strain_type: string
          thc_content: number
        }[]
      }
      get_marketplace_store_by_slug: {
        Args: { p_slug: string }
        Returns: {
          accent_color: string
          banner_url: string
          checkout_settings: Json
          created_at: string
          default_delivery_fee: number
          description: string
          free_delivery_threshold: number
          id: string
          is_active: boolean
          is_public: boolean
          layout_config: Json
          logo_url: string
          minimum_age: number
          operating_hours: Json
          payment_methods: Json
          primary_color: string
          require_age_verification: boolean
          secondary_color: string
          slug: string
          store_name: string
          tagline: string
          tenant_id: string
          theme_config: Json
          updated_at: string
        }[]
      }
      get_menu_encryption_key: { Args: never; Returns: string }
      get_order_by_tracking_code: { Args: { code: string }; Returns: Json }
      get_order_tracking_by_code: {
        Args: { tracking_code_param: string }
        Returns: {
          courier_lat: number
          courier_lng: number
          courier_name: string
          courier_vehicle: string
          created_at: string
          delivered_at: string
          delivery_address: string
          delivery_borough: string
          estimated_delivery: string
          id: string
          merchant_address: string
          merchant_name: string
          order_number: string
          status: string
          total_amount: number
          tracking_code: string
        }[]
      }
      get_product_by_slug: {
        Args: { p_slug: string; p_store_id: string }
        Returns: {
          brand: string
          category: string
          cbd_content: number
          created_at: string
          description: string
          image_url: string
          images: string[]
          is_featured: boolean
          is_on_sale: boolean
          price: number
          prices: Json
          product_id: string
          product_name: string
          sale_price: number
          sku: string
          slug: string
          sort_order: number
          stock_quantity: number
          strain_type: string
          thc_content: number
        }[]
      }
      get_product_with_images: {
        Args: { p_product_id: string }
        Returns: {
          category: string
          id: string
          images: Json
          price_per_lb: number
          product_name: string
        }[]
      }
      get_public_invoice: { Args: { p_token: string }; Returns: Json }
      get_route_statistics: {
        Args: {
          p_delivery_id?: string
          p_end_time?: string
          p_runner_id: string
          p_start_time?: string
        }
        Returns: {
          average_speed: number
          max_speed: number
          points_count: number
          total_distance: number
          total_duration: unknown
        }[]
      }
      get_store_by_encrypted_token: {
        Args: { p_token: string }
        Returns: {
          accent_color: string | null
          banner_url: string | null
          checkout_settings: Json | null
          created_at: string | null
          custom_domain: string | null
          default_delivery_fee: number | null
          delivery_zones: Json | null
          description: string | null
          encrypted_url_token: string | null
          favicon_url: string | null
          font_family: string | null
          free_delivery_threshold: number | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          layout_config: Json | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          minimum_age: number | null
          og_image_url: string | null
          operating_hours: Json | null
          payment_methods: Json | null
          primary_color: string | null
          require_account: boolean | null
          require_age_verification: boolean | null
          secondary_color: string | null
          slug: string
          store_name: string
          tagline: string | null
          tenant_id: string
          theme_config: Json | null
          total_customers: number | null
          total_orders: number | null
          total_revenue: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "marketplace_stores"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_trial_days_remaining: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      get_unread_message_count: {
        Args: { p_tenant_id?: string; p_user_id: string }
        Returns: number
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_ids_safe: {
        Args: { user_uuid: string }
        Returns: string[]
      }
      grant_free_credits: {
        Args: { p_amount?: number; p_tenant_id: string }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_admin_pin: { Args: { pin_text: string }; Returns: string }
      increment_coupon_usage: {
        Args: { coupon_id: string }
        Returns: undefined
      }
      increment_feature_usage: {
        Args: { p_feature_id: string; p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      increment_giveaway_entries: {
        Args: { p_entries: number; p_giveaway_id: string; p_user_id: string }
        Returns: undefined
      }
      increment_runner_deliveries: {
        Args: { p_runner_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_age_verified: { Args: { _user_id: string }; Returns: boolean }
      is_device_blocked: { Args: { _fingerprint: string }; Returns: boolean }
      is_error_retryable: {
        Args: { p_error_type: string; p_retry_config: Json }
        Returns: boolean
      }
      is_ip_blocked: { Args: { _ip_address: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_tenant_admin_safe: {
        Args: { check_tenant_id: string; user_uuid: string }
        Returns: boolean
      }
      is_tenant_member_safe: {
        Args: { check_tenant_id: string; user_uuid: string }
        Returns: boolean
      }
      is_tenant_owner: { Args: { p_tenant_id: string }; Returns: boolean }
      is_trial_active: { Args: { p_tenant_id: string }; Returns: boolean }
      log_action_with_limit: {
        Args: {
          p_action_type: string
          p_limit: number
          p_metadata?: Json
          p_tenant_id: string
          p_user_id: string
          p_window_hours?: number
        }
        Returns: Json
      }
      log_document_access: {
        Args: { _access_type: string; _verification_id: string }
        Returns: undefined
      }
      log_notification: {
        Args: {
          p_message_preview?: string
          p_metadata?: Json
          p_notification_type: string
          p_recipient: string
          p_status?: string
          p_subject?: string
          p_tenant_id: string
        }
        Returns: string
      }
      log_phi_access: {
        Args: {
          p_action: string
          p_customer_id: string
          p_fields_accessed: string[]
          p_purpose?: string
        }
        Returns: string
      }
      log_pin_verification: {
        Args: { courier_user_id: string; success: boolean }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          _action: string
          _details?: Json
          _entity_id: string
          _entity_type: string
          _ip_address?: string
          _user_id: string
        }
        Returns: string
      }
      mark_messages_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      move_to_dead_letter_queue: {
        Args: { p_execution_id: string }
        Returns: string
      }
      purchase_credits: {
        Args: {
          p_amount: number
          p_stripe_payment_id?: string
          p_tenant_id: string
        }
        Returns: number
      }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_payment_method?: string
          p_reference?: string
        }
        Returns: Json
      }
      redeem_coupon: { Args: { p_coupon_id: string }; Returns: Json }
      refresh_dashboard_metrics: { Args: never; Returns: undefined }
      refresh_menu_analytics: { Args: never; Returns: undefined }
      regenerate_backup_codes: {
        Args: { p_code_hashes: string[]; p_user_id: string }
        Returns: number
      }
      release_order_inventory: {
        Args: { p_order_id: string; p_order_type?: string }
        Returns: Json
      }
      release_reserved_inventory: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      reserve_inventory: {
        Args: { p_items: Json; p_menu_id: string; p_trace_id?: string }
        Returns: Json
      }
      reserve_inventory_for_order: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: boolean
      }
      reset_daily_credit_usage: { Args: never; Returns: undefined }
      resolve_dead_letter_entry: {
        Args: { p_dlq_id: string; p_notes?: string; p_user_id: string }
        Returns: undefined
      }
      resolve_inventory_alert: {
        Args: { alert_id: string }
        Returns: undefined
      }
      restore_wholesale_client: {
        Args: { p_client_id: string; p_tenant_id: string }
        Returns: boolean
      }
      restore_workflow_version: {
        Args: { p_version_number: number; p_workflow_id: string }
        Returns: Json
      }
      retry_from_dead_letter_queue: {
        Args: { p_dlq_id: string; p_user_id?: string }
        Returns: string
      }
      search_global_products: {
        Args: {
          p_brand?: string
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          brand: string
          category: string
          cbd_percent: number
          description: string
          effects: string[]
          id: string
          images: string[]
          is_verified: boolean
          name: string
          sku: string
          strain_type: string
          thc_percent: number
        }[]
      }
      snooze_inventory_alert: {
        Args: { p_alert_id: string; p_snooze_hours?: number }
        Returns: boolean
      }
      soft_delete_wholesale_client: {
        Args: { p_client_id: string; p_tenant_id: string }
        Returns: boolean
      }
      sync_product_to_marketplace: {
        Args: { p_product_id: string; p_store_id: string }
        Returns: Json
      }
      track_feature_usage: {
        Args: { p_feature_id: string; p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      track_ip_address: {
        Args: { _ip_address: string; _user_id: string }
        Returns: undefined
      }
      update_client_reliability: {
        Args: { p_client_id: string; p_payment_made?: boolean }
        Returns: undefined
      }
      update_contact_balance: {
        Args: { p_amount: number; p_contact_id: string; p_operation: string }
        Returns: number
      }
      update_license_statuses: { Args: never; Returns: number }
      update_notification_status: {
        Args: { p_error_message?: string; p_log_id: string; p_status: string }
        Returns: boolean
      }
      update_order_status: {
        Args: {
          p_cancellation_reason?: string
          p_new_status: string
          p_order_id: string
        }
        Returns: undefined
      }
      update_purchase_limits: {
        Args: {
          _concentrate_grams: number
          _date: string
          _flower_grams: number
          _user_id: string
        }
        Returns: undefined
      }
      update_tenant_tier: {
        Args: { p_override?: boolean; p_tenant_id: string; p_tier: string }
        Returns: undefined
      }
      validate_cart_items: {
        Args: { p_items: Json; p_store_id: string }
        Returns: Json
      }
      validate_coupon: {
        Args: {
          p_cart_items?: Json
          p_code: string
          p_store_id: string
          p_subtotal: number
        }
        Returns: Json
      }
      validate_courier_pin_session: {
        Args: { p_courier_id: string; p_session_token: string }
        Returns: boolean
      }
      validate_marketplace_coupon: {
        Args: { p_code: string; p_store_id: string; p_subtotal: number }
        Returns: {
          discount_amount: number
          discount_type: string
          error_message: string
          is_valid: boolean
        }[]
      }
      verify_admin_pin: {
        Args: { courier_user_id: string; pin: string }
        Returns: boolean
      }
      void_pos_transaction: {
        Args: {
          p_reason: string
          p_restore_inventory?: boolean
          p_transaction_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      admin_role: "super_admin" | "admin" | "compliance_officer" | "support"
      app_role:
        | "admin"
        | "courier"
        | "user"
        | "super_admin"
        | "owner"
        | "member"
        | "viewer"
      burn_type: "soft" | "hard"
      event_severity: "low" | "medium" | "high" | "critical"
      menu_access_type: "invite_only" | "shared_link" | "hybrid"
      menu_order_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "processing"
        | "preparing"
        | "ready_for_pickup"
        | "in_transit"
        | "completed"
        | "cancelled"
        | "delivered"
      menu_status: "active" | "soft_burned" | "hard_burned"
      order_status_type:
        | "pending"
        | "accepted"
        | "preparing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method_type: "cash" | "crypto"
      payment_status_type: "pending" | "completed" | "failed" | "refunded"
      pos_transaction_status: "completed" | "voided" | "refunded" | "pending"
      product_category_type:
        | "flower"
        | "edibles"
        | "vapes"
        | "concentrates"
        | "pre-rolls"
      security_event_type:
        | "failed_access_code"
        | "geofence_violation"
        | "screenshot_attempt"
        | "new_device_detected"
        | "excessive_views"
        | "suspicious_ip"
        | "link_sharing_detected"
      vehicle_type: "car" | "bike" | "scooter" | "ebike"
      verification_method_type: "jumio" | "manual_scan" | "automatic"
      verification_type: "registration" | "delivery"
      whitelist_status: "pending" | "active" | "revoked" | "blocked"
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
      admin_role: ["super_admin", "admin", "compliance_officer", "support"],
      app_role: [
        "admin",
        "courier",
        "user",
        "super_admin",
        "owner",
        "member",
        "viewer",
      ],
      burn_type: ["soft", "hard"],
      event_severity: ["low", "medium", "high", "critical"],
      menu_access_type: ["invite_only", "shared_link", "hybrid"],
      menu_order_status: [
        "pending",
        "confirmed",
        "rejected",
        "processing",
        "preparing",
        "ready_for_pickup",
        "in_transit",
        "completed",
        "cancelled",
        "delivered",
      ],
      menu_status: ["active", "soft_burned", "hard_burned"],
      order_status_type: [
        "pending",
        "accepted",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method_type: ["cash", "crypto"],
      payment_status_type: ["pending", "completed", "failed", "refunded"],
      pos_transaction_status: ["completed", "voided", "refunded", "pending"],
      product_category_type: [
        "flower",
        "edibles",
        "vapes",
        "concentrates",
        "pre-rolls",
      ],
      security_event_type: [
        "failed_access_code",
        "geofence_violation",
        "screenshot_attempt",
        "new_device_detected",
        "excessive_views",
        "suspicious_ip",
        "link_sharing_detected",
      ],
      vehicle_type: ["car", "bike", "scooter", "ebike"],
      verification_method_type: ["jumio", "manual_scan", "automatic"],
      verification_type: ["registration", "delivery"],
      whitelist_status: ["pending", "active", "revoked", "blocked"],
    },
  },
} as const
