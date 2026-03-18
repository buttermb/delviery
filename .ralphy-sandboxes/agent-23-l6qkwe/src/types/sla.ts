/**
 * SLA (Service Level Agreement) Type Definitions
 * Types for order SLA tracking and compliance
 */

import type { OrderStatus } from '@/types/order';

/**
 * SLA target configuration for each status transition
 * Times are in minutes
 */
export interface SLATargets {
  /** Max time from created to confirmed (minutes) */
  pending_to_confirmed: number;
  /** Max time from confirmed to preparing (minutes) */
  confirmed_to_preparing: number;
  /** Max time from preparing to ready (minutes) */
  preparing_to_ready: number;
  /** Max time from ready to in_transit (minutes) */
  ready_to_in_transit: number;
  /** Max time from in_transit to delivered (minutes) */
  in_transit_to_delivered: number;
}

/**
 * Default SLA targets (in minutes)
 */
export const DEFAULT_SLA_TARGETS: SLATargets = {
  pending_to_confirmed: 15,
  confirmed_to_preparing: 10,
  preparing_to_ready: 30,
  ready_to_in_transit: 15,
  in_transit_to_delivered: 45,
};

/**
 * SLA status indicators
 */
export type SLAStatus = 'on_track' | 'approaching' | 'overdue';

/**
 * SLA calculation result for an order
 */
export interface OrderSLAResult {
  /** Current SLA status */
  status: SLAStatus;
  /** Time elapsed in current phase (minutes) */
  elapsedMinutes: number;
  /** Target time for current phase (minutes) */
  targetMinutes: number;
  /** Remaining time before SLA breach (can be negative) */
  remainingMinutes: number;
  /** Percentage of target time used */
  percentageUsed: number;
  /** Current order status */
  currentStatus: OrderStatus;
  /** Next expected status in workflow */
  nextStatus: OrderStatus | null;
}

/**
 * SLA compliance summary for dashboard
 */
export interface SLAComplianceSummary {
  /** Total orders evaluated */
  totalOrders: number;
  /** Orders within SLA */
  onTrackCount: number;
  /** Orders approaching SLA breach */
  approachingCount: number;
  /** Orders past SLA target */
  overdueCount: number;
  /** Overall compliance percentage */
  compliancePercentage: number;
  /** Breakdown by current status */
  byStatus: Record<OrderStatus, {
    total: number;
    onTrack: number;
    approaching: number;
    overdue: number;
  }>;
}

/**
 * Order with SLA-relevant timestamps
 */
export interface OrderWithSLATimestamps {
  id: string;
  status: OrderStatus;
  created_at: string;
  accepted_at?: string | null;
  courier_assigned_at?: string | null;
  courier_accepted_at?: string | null;
  delivered_at?: string | null;
  /** Timestamp when status was last changed */
  status_changed_at?: string | null;
}

/**
 * Status transition map for SLA calculations
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'in_transit',
  in_transit: 'delivered',
  delivered: null,
  cancelled: null,
  rejected: null,
};

/**
 * SLA key for each status (maps to SLATargets keys)
 */
export const STATUS_SLA_KEY: Partial<Record<OrderStatus, keyof SLATargets>> = {
  pending: 'pending_to_confirmed',
  confirmed: 'confirmed_to_preparing',
  preparing: 'preparing_to_ready',
  ready: 'ready_to_in_transit',
  in_transit: 'in_transit_to_delivered',
};
