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
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          total_deliveries?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: []
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
          user_id?: string
        }
        Relationships: []
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
      giveaway_entries: {
        Row: {
          base_entries: number | null
          device_fingerprint: string | null
          email_otp: string | null
          email_verified: boolean | null
          entered_at: string | null
          entry_number_end: number | null
          entry_number_start: number | null
          entry_type: string | null
          fraud_score: number | null
          giveaway_id: string | null
          id: string
          instagram_handle: string | null
          instagram_post_entries: number | null
          instagram_story_entries: number | null
          instagram_tag_url: string | null
          instagram_verified: boolean | null
          ip_address: string | null
          last_error: string | null
          newsletter_entries: number | null
          order_id: string | null
          otp_expiry: string | null
          phone_otp: string | null
          phone_verified: boolean | null
          referral_entries: number | null
          retry_count: number | null
          status: string | null
          total_entries: number | null
          user_agent: string | null
          user_borough: string | null
          user_email: string | null
          user_first_name: string | null
          user_id: string | null
          user_last_name: string | null
          user_phone: string | null
          verified_at: string | null
        }
        Insert: {
          base_entries?: number | null
          device_fingerprint?: string | null
          email_otp?: string | null
          email_verified?: boolean | null
          entered_at?: string | null
          entry_number_end?: number | null
          entry_number_start?: number | null
          entry_type?: string | null
          fraud_score?: number | null
          giveaway_id?: string | null
          id?: string
          instagram_handle?: string | null
          instagram_post_entries?: number | null
          instagram_story_entries?: number | null
          instagram_tag_url?: string | null
          instagram_verified?: boolean | null
          ip_address?: string | null
          last_error?: string | null
          newsletter_entries?: number | null
          order_id?: string | null
          otp_expiry?: string | null
          phone_otp?: string | null
          phone_verified?: boolean | null
          referral_entries?: number | null
          retry_count?: number | null
          status?: string | null
          total_entries?: number | null
          user_agent?: string | null
          user_borough?: string | null
          user_email?: string | null
          user_first_name?: string | null
          user_id?: string | null
          user_last_name?: string | null
          user_phone?: string | null
          verified_at?: string | null
        }
        Update: {
          base_entries?: number | null
          device_fingerprint?: string | null
          email_otp?: string | null
          email_verified?: boolean | null
          entered_at?: string | null
          entry_number_end?: number | null
          entry_number_start?: number | null
          entry_type?: string | null
          fraud_score?: number | null
          giveaway_id?: string | null
          id?: string
          instagram_handle?: string | null
          instagram_post_entries?: number | null
          instagram_story_entries?: number | null
          instagram_tag_url?: string | null
          instagram_verified?: boolean | null
          ip_address?: string | null
          last_error?: string | null
          newsletter_entries?: number | null
          order_id?: string | null
          otp_expiry?: string | null
          phone_otp?: string | null
          phone_verified?: boolean | null
          referral_entries?: number | null
          retry_count?: number | null
          status?: string | null
          total_entries?: number | null
          user_agent?: string | null
          user_borough?: string | null
          user_email?: string | null
          user_first_name?: string | null
          user_id?: string | null
          user_last_name?: string | null
          user_phone?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_entries_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_errors: {
        Row: {
          attempt_data: Json | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          resolved: boolean | null
        }
        Insert: {
          attempt_data?: Json | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          resolved?: boolean | null
        }
        Update: {
          attempt_data?: Json | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          resolved?: boolean | null
        }
        Relationships: []
      }
      giveaway_failed_attempts: {
        Row: {
          created_at: string | null
          device_fingerprint: string | null
          email: string | null
          error_message: string | null
          error_type: string | null
          id: string
          instagram_handle: string | null
          ip_address: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          device_fingerprint?: string | null
          email?: string | null
          error_message?: string | null
          error_type?: string | null
          id?: string
          instagram_handle?: string | null
          ip_address?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string | null
          email?: string | null
          error_message?: string | null
          error_type?: string | null
          id?: string
          instagram_handle?: string | null
          ip_address?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      giveaway_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          email: string | null
          id: string
          last_error: string | null
          order_id: string | null
          phone: string | null
          processed_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          phone?: string | null
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          phone?: string | null
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "giveaway_referrals_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "giveaway_winners_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "giveaway_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_winners_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaways: {
        Row: {
          base_entries: number | null
          created_at: string | null
          description: string | null
          end_date: string
          grand_prize_description: string | null
          grand_prize_title: string | null
          grand_prize_value: number | null
          id: string
          instagram_post_bonus_entries: number | null
          instagram_story_bonus_entries: number | null
          newsletter_bonus_entries: number | null
          referral_bonus_entries: number | null
          second_prize_title: string | null
          second_prize_value: number | null
          slug: string
          start_date: string
          status: string | null
          tagline: string | null
          third_prize_title: string | null
          third_prize_value: number | null
          title: string
          total_entries: number | null
          total_participants: number | null
          updated_at: string | null
        }
        Insert: {
          base_entries?: number | null
          created_at?: string | null
          description?: string | null
          end_date: string
          grand_prize_description?: string | null
          grand_prize_title?: string | null
          grand_prize_value?: number | null
          id?: string
          instagram_post_bonus_entries?: number | null
          instagram_story_bonus_entries?: number | null
          newsletter_bonus_entries?: number | null
          referral_bonus_entries?: number | null
          second_prize_title?: string | null
          second_prize_value?: number | null
          slug: string
          start_date: string
          status?: string | null
          tagline?: string | null
          third_prize_title?: string | null
          third_prize_value?: number | null
          title: string
          total_entries?: number | null
          total_participants?: number | null
          updated_at?: string | null
        }
        Update: {
          base_entries?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          grand_prize_description?: string | null
          grand_prize_title?: string | null
          grand_prize_value?: number | null
          id?: string
          instagram_post_bonus_entries?: number | null
          instagram_story_bonus_entries?: number | null
          newsletter_bonus_entries?: number | null
          referral_bonus_entries?: number | null
          second_prize_title?: string | null
          second_prize_value?: number | null
          slug?: string
          start_date?: string
          status?: string | null
          tagline?: string | null
          third_prize_title?: string | null
          third_prize_value?: number | null
          title?: string
          total_entries?: number | null
          total_participants?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
          address_id: string | null
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
          tip_amount: number | null
          total_amount: number
          tracking_code: string | null
          tracking_url: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          address_id?: string | null
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
          tip_amount?: number | null
          total_amount: number
          tracking_code?: string | null
          tracking_url?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          address_id?: string | null
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
          tip_amount?: number | null
          total_amount?: number
          tracking_code?: string | null
          tracking_url?: string | null
          user_id?: string | null
        }
        Relationships: [
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
      products: {
        Row: {
          average_rating: number | null
          batch_number: string | null
          category: string
          cbd_content: number | null
          coa_pdf_url: string | null
          coa_qr_code_url: string | null
          coa_url: string | null
          consumption_methods: string[] | null
          cost_per_unit: number | null
          created_at: string | null
          description: string | null
          effects: string[] | null
          effects_timeline: Json | null
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
          merchant_id: string | null
          name: string
          price: number
          prices: Json | null
          review_count: number | null
          sale_price: number | null
          stock_quantity: number | null
          strain_info: string | null
          strain_lineage: string | null
          strain_type: string | null
          terpenes: Json | null
          test_date: string | null
          thc_content: number | null
          thca_percentage: number
          usage_tips: string | null
          vendor_name: string | null
          weight_grams: number | null
        }
        Insert: {
          average_rating?: number | null
          batch_number?: string | null
          category: string
          cbd_content?: number | null
          coa_pdf_url?: string | null
          coa_qr_code_url?: string | null
          coa_url?: string | null
          consumption_methods?: string[] | null
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          effects?: string[] | null
          effects_timeline?: Json | null
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
          merchant_id?: string | null
          name: string
          price: number
          prices?: Json | null
          review_count?: number | null
          sale_price?: number | null
          stock_quantity?: number | null
          strain_info?: string | null
          strain_lineage?: string | null
          strain_type?: string | null
          terpenes?: Json | null
          test_date?: string | null
          thc_content?: number | null
          thca_percentage: number
          usage_tips?: string | null
          vendor_name?: string | null
          weight_grams?: number | null
        }
        Update: {
          average_rating?: number | null
          batch_number?: string | null
          category?: string
          cbd_content?: number | null
          coa_pdf_url?: string | null
          coa_qr_code_url?: string | null
          coa_url?: string | null
          consumption_methods?: string[] | null
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          effects?: string[] | null
          effects_timeline?: Json | null
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
          merchant_id?: string | null
          name?: string
          price?: number
          prices?: Json | null
          review_count?: number | null
          sale_price?: number | null
          stock_quantity?: number | null
          strain_info?: string | null
          strain_lineage?: string | null
          strain_type?: string | null
          terpenes?: Json | null
          test_date?: string | null
          thc_content?: number | null
          thca_percentage?: number
          usage_tips?: string | null
          vendor_name?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
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
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      calculate_risk_score: { Args: { p_user_id: string }; Returns: number }
      check_is_admin: { Args: { _user_id: string }; Returns: boolean }
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
      decrement_giveaway_entries: {
        Args: { p_entries: number; p_giveaway_id: string; p_user_id: string }
        Returns: undefined
      }
      decrement_inventory: {
        Args: { _product_id: string; _quantity: number }
        Returns: boolean
      }
      generate_admin_pin: { Args: never; Returns: string }
      generate_entry_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_otp: { Args: never; Returns: string }
      generate_po_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      generate_tracking_code: { Args: never; Returns: string }
      generate_transfer_number: { Args: never; Returns: string }
      generate_user_id_code: {
        Args: { p_borough: string; p_user_id: string }
        Returns: string
      }
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
      increment_giveaway_entries: {
        Args: { p_entries: number; p_giveaway_id: string; p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_age_verified: { Args: { _user_id: string }; Returns: boolean }
      is_device_blocked: { Args: { _fingerprint: string }; Returns: boolean }
      is_ip_blocked: { Args: { _ip_address: string }; Returns: boolean }
      log_document_access: {
        Args: { _access_type: string; _verification_id: string }
        Returns: undefined
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
      track_ip_address: {
        Args: { _ip_address: string; _user_id: string }
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
      validate_courier_pin_session: {
        Args: { p_courier_id: string; p_session_token: string }
        Returns: boolean
      }
      verify_admin_pin: {
        Args: { courier_user_id: string; pin: string }
        Returns: boolean
      }
    }
    Enums: {
      admin_role: "super_admin" | "admin" | "compliance_officer" | "support"
      app_role: "admin" | "courier" | "user"
      order_status_type:
        | "pending"
        | "accepted"
        | "preparing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method_type: "cash" | "crypto"
      payment_status_type: "pending" | "completed" | "failed" | "refunded"
      product_category_type:
        | "flower"
        | "edibles"
        | "vapes"
        | "concentrates"
        | "pre-rolls"
      vehicle_type: "car" | "bike" | "scooter" | "ebike"
      verification_method_type: "jumio" | "manual_scan" | "automatic"
      verification_type: "registration" | "delivery"
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
      app_role: ["admin", "courier", "user"],
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
      product_category_type: [
        "flower",
        "edibles",
        "vapes",
        "concentrates",
        "pre-rolls",
      ],
      vehicle_type: ["car", "bike", "scooter", "ebike"],
      verification_method_type: ["jumio", "manual_scan", "automatic"],
      verification_type: ["registration", "delivery"],
    },
  },
} as const
