/**
 * SLA Calculation Utilities
 * Functions to calculate SLA metrics for orders
 */

import { differenceInMinutes } from 'date-fns';

import type {
  SLATargets,
  SLAStatus,
  OrderSLAResult,
  SLAComplianceSummary,
  OrderWithSLATimestamps,
} from '@/types/sla';
import type { OrderStatus } from '@/types/order';
import {
  DEFAULT_SLA_TARGETS,
  STATUS_TRANSITIONS,
  STATUS_SLA_KEY,
} from '@/types/sla';

/**
 * Threshold percentage for "approaching" status (default: 80%)
 */
const APPROACHING_THRESHOLD = 0.8;

/**
 * Calculate SLA status for a single order
 */
export function calculateOrderSLA(
  order: OrderWithSLATimestamps,
  slaTargets: SLATargets = DEFAULT_SLA_TARGETS,
  referenceTime: Date = new Date()
): OrderSLAResult | null {
  const { status, created_at, status_changed_at } = order;

  // Terminal statuses don't have active SLA
  if (status === 'delivered' || status === 'cancelled' || status === 'rejected') {
    return null;
  }

  const slaKey = STATUS_SLA_KEY[status as OrderStatus];
  if (!slaKey) {
    return null;
  }

  const targetMinutes = slaTargets[slaKey];
  const nextStatus = STATUS_TRANSITIONS[status as OrderStatus];

  // Use status_changed_at if available, otherwise use created_at
  const phaseStartTime = status_changed_at
    ? new Date(status_changed_at)
    : new Date(created_at);

  const elapsedMinutes = differenceInMinutes(referenceTime, phaseStartTime);
  const remainingMinutes = targetMinutes - elapsedMinutes;
  const percentageUsed = (elapsedMinutes / targetMinutes) * 100;

  // Determine SLA status
  let slaStatus: SLAStatus;
  if (elapsedMinutes >= targetMinutes) {
    slaStatus = 'overdue';
  } else if (elapsedMinutes >= targetMinutes * APPROACHING_THRESHOLD) {
    slaStatus = 'approaching';
  } else {
    slaStatus = 'on_track';
  }

  return {
    status: slaStatus,
    elapsedMinutes,
    targetMinutes,
    remainingMinutes,
    percentageUsed: Math.min(percentageUsed, 100),
    currentStatus: status as OrderStatus,
    nextStatus,
  };
}

/**
 * Calculate SLA compliance summary for multiple orders
 */
export function calculateSLAComplianceSummary(
  orders: OrderWithSLATimestamps[],
  slaTargets: SLATargets = DEFAULT_SLA_TARGETS,
  referenceTime: Date = new Date()
): SLAComplianceSummary {
  const byStatus: SLAComplianceSummary['byStatus'] = {
    pending: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    confirmed: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    preparing: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    ready: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    in_transit: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    delivered: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    cancelled: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
    rejected: { total: 0, onTrack: 0, approaching: 0, overdue: 0 },
  };

  let onTrackCount = 0;
  let approachingCount = 0;
  let overdueCount = 0;
  let evaluatedCount = 0;

  for (const order of orders) {
    const slaResult = calculateOrderSLA(order, slaTargets, referenceTime);

    // Skip terminal statuses
    if (!slaResult) {
      continue;
    }

    evaluatedCount++;
    const statusKey = order.status as OrderStatus;
    byStatus[statusKey].total++;

    switch (slaResult.status) {
      case 'on_track':
        onTrackCount++;
        byStatus[statusKey].onTrack++;
        break;
      case 'approaching':
        approachingCount++;
        byStatus[statusKey].approaching++;
        break;
      case 'overdue':
        overdueCount++;
        byStatus[statusKey].overdue++;
        break;
    }
  }

  const compliancePercentage = evaluatedCount > 0
    ? Math.round((onTrackCount / evaluatedCount) * 100)
    : 100;

  return {
    totalOrders: evaluatedCount,
    onTrackCount,
    approachingCount,
    overdueCount,
    compliancePercentage,
    byStatus,
  };
}

/**
 * Get SLA status display properties
 */
export function getSLAStatusDisplay(status: SLAStatus): {
  label: string;
  color: 'green' | 'yellow' | 'red';
  className: string;
  bgClassName: string;
} {
  switch (status) {
    case 'on_track':
      return {
        label: 'On Track',
        color: 'green',
        className: 'text-green-600 dark:text-green-400',
        bgClassName: 'bg-green-100 dark:bg-green-900/30',
      };
    case 'approaching':
      return {
        label: 'Approaching',
        color: 'yellow',
        className: 'text-yellow-600 dark:text-yellow-400',
        bgClassName: 'bg-yellow-100 dark:bg-yellow-900/30',
      };
    case 'overdue':
      return {
        label: 'Overdue',
        color: 'red',
        className: 'text-red-600 dark:text-red-400',
        bgClassName: 'bg-red-100 dark:bg-red-900/30',
      };
  }
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) {
    const overdueMinutes = Math.abs(minutes);
    if (overdueMinutes >= 60) {
      const hours = Math.floor(overdueMinutes / 60);
      const mins = overdueMinutes % 60;
      return mins > 0 ? `-${hours}h ${mins}m` : `-${hours}h`;
    }
    return `-${overdueMinutes}m`;
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
