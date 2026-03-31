/**
 * Alert threshold configuration and shared types for credit threshold alerts.
 */

export const ALERT_THRESHOLDS = [
  {
    id: 'warning_2000',
    credits: 2000,
    channels: ['in_app'],
    severity: 'info',
    title: 'Credit Balance Update',
    message: 'You have 2,000 credits remaining',
  },
  {
    id: 'warning_1000',
    credits: 1000,
    channels: ['in_app', 'email'],
    severity: 'warning',
    title: 'Credits Running Low',
    message: 'Only 1,000 credits left',
  },
  {
    id: 'warning_500',
    credits: 500,
    channels: ['in_app', 'email'],
    severity: 'critical',
    title: 'Credits Almost Gone',
    message: 'Critical: 500 credits remaining',
  },
  {
    id: 'warning_100',
    credits: 100,
    channels: ['in_app', 'email', 'sms'],
    severity: 'urgent',
    title: 'Urgent: Almost Out',
    message: 'Almost out! Only 100 credits left',
  },
  {
    id: 'warning_0',
    credits: 0,
    channels: ['in_app', 'email', 'sms'],
    severity: 'depleted',
    title: 'Credits Depleted',
    message: 'Out of credits! Top up now',
  },
] as const;

export type AlertThreshold = typeof ALERT_THRESHOLDS[number];

export interface RequestBody {
  mode?: 'cron' | 'realtime';
  tenant_id?: string;
  new_balance?: number;
}

export interface AlertResult {
  tenant_id: string;
  threshold: string;
  channels_sent: string[];
  success: boolean;
  error?: string;
}
