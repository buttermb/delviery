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
          metadata: Record<string, any> | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          metric_type: string;
          value: number;
          metadata?: Record<string, any> | null;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          metric_type?: string;
          value?: number;
          metadata?: Record<string, any> | null;
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
          details: Record<string, any> | null;
          ip_address: string | null;
          created_at: string;
          resource_type: string | null;
          tenant_id: string | null;
          actor_type: string | null;
          timestamp: string | null;
          metadata: Record<string, any> | null;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          action: string;
          user_id?: string | null;
          details?: Record<string, any> | null;
          ip_address?: string | null;
          created_at?: string;
          resource_type?: string | null;
          tenant_id?: string | null;
          actor_type?: string | null;
          timestamp?: string | null;
          metadata?: Record<string, any> | null;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          user_id?: string | null;
          details?: Record<string, any> | null;
          ip_address?: string | null;
          created_at?: string;
          resource_type?: string | null;
          tenant_id?: string | null;
          actor_type?: string | null;
          timestamp?: string | null;
          metadata?: Record<string, any> | null;
        };
      };
    };
  };
};

export type SystemMetric = ExtendedDatabase['public']['Tables']['system_metrics']['Row'];
export type APILog = ExtendedDatabase['public']['Tables']['api_logs']['Row'];
export type ExtendedAuditLog = ExtendedDatabase['public']['Tables']['audit_logs']['Row'];
