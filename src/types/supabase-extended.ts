/**
 * Extended Supabase Types
 * Temporary type definitions for new tables until types.ts regenerates
 */

import { Database } from '@/integrations/supabase/types';

// Extend the Database type with new tables
export type ExtendedDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      system_metrics: {
        Row: {
          id: string;
          metric_type: string;
          value: number;
          metadata: Record<string, unknown> | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          metric_type: string;
          value: number;
          metadata?: Record<string, unknown> | null;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          metric_type?: string;
          value?: number;
          metadata?: Record<string, unknown> | null;
          timestamp?: string;
          created_at?: string;
        };
      };
      api_logs: {
        Row: {
          id: string;
          endpoint: string;
          method: string;
          status_code: number | null;
          response_time_ms: number | null;
          tenant_id: string | null;
          user_agent: string | null;
          ip_address: string | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          endpoint: string;
          method: string;
          status_code?: number | null;
          response_time_ms?: number | null;
          tenant_id?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          endpoint?: string;
          method?: string;
          status_code?: number | null;
          response_time_ms?: number | null;
          tenant_id?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          timestamp?: string;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          user_id: string | null;
          details: Record<string, unknown> | null;
          ip_address: string | null;
          created_at: string;
          resource_type: string | null;
          resource_id: string | null;
          tenant_id: string | null;
          actor_id: string | null;
          actor_type: string | null;
          timestamp: string | null;
          metadata: Record<string, unknown> | null;
          changes: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          action: string;
          user_id?: string | null;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          created_at?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          tenant_id?: string | null;
          actor_id?: string | null;
          actor_type?: string | null;
          timestamp?: string | null;
          metadata?: Record<string, unknown> | null;
          changes?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          user_id?: string | null;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          created_at?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          tenant_id?: string | null;
          actor_id?: string | null;
          actor_type?: string | null;
          timestamp?: string | null;
          metadata?: Record<string, unknown> | null;
          changes?: Record<string, unknown> | null;
        };
      };
      super_admins: {
        Row: {
          id: string;
          email: string;
          [key: string]: unknown;
        };
        Insert: {
          id?: string;
          email: string;
          [key: string]: unknown;
        };
        Update: {
          id?: string;
          email?: string;
          [key: string]: unknown;
        };
      };
    };
  };
};

export type SystemMetric = ExtendedDatabase['public']['Tables']['system_metrics']['Row'];
export type APILog = ExtendedDatabase['public']['Tables']['api_logs']['Row'];
export type ExtendedAuditLog = ExtendedDatabase['public']['Tables']['audit_logs']['Row'];
