/**
 * Shared Types for Edge Functions
 */

export interface SystemMetric {
  metric_type: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface UptimeCheck {
  service_name: string;
  endpoint: string;
  status: 'up' | 'down' | 'degraded';
  response_time_ms?: number;
  error_message?: string;
}

export interface APILog {
  tenant_id?: string;
  endpoint: string;
  method: string;
  status_code?: number;
  response_time_ms?: number;
  user_agent?: string;
  ip_address?: string;
}

