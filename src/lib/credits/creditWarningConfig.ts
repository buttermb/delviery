/**
 * Credit Warning Configuration
 *
 * Single source of truth for credit warning thresholds, severity levels,
 * color mappings, and warning messages used across CreditBalance badge,
 * CreditAlertBanner, useCreditAlert hook, and useCredits toast warnings.
 *
 * Thresholds: 2000, 1000, 500, 100
 * Severity progression: info -> warning -> critical -> danger
 */

// ============================================================================
// Types
// ============================================================================

export type CreditWarningSeverity = 'info' | 'warning' | 'critical' | 'danger';

export type CreditToastType = 'info' | 'warning' | 'error';

export interface CreditThresholdConfig {
  threshold: number;
  severity: CreditWarningSeverity;
  toastType: CreditToastType;
  title: string;
  description: string;
}

export interface BadgeColorClasses {
  text: string;
  bg: string;
  border: string;
  extra?: string;
}

export interface AlertSeverityStyles {
  variant: 'default' | 'destructive';
  iconColor: string;
  bgColor: string;
  borderColor: string;
}

// ============================================================================
// Threshold Configs (ordered high to low)
// ============================================================================

export const CREDIT_THRESHOLD_CONFIGS: CreditThresholdConfig[] = [
  {
    threshold: 2000,
    severity: 'info',
    toastType: 'info',
    title: 'Credits Running Low',
    description: 'You have {balance} credits remaining. Consider purchasing more to avoid interruptions.',
  },
  {
    threshold: 1000,
    severity: 'warning',
    toastType: 'warning',
    title: 'Credit Balance Warning',
    description: 'Only {balance} credits left. Some features may become unavailable soon.',
  },
  {
    threshold: 500,
    severity: 'critical',
    toastType: 'warning',
    title: 'Low Credit Balance',
    description: 'Only {balance} credits remaining. Purchase credits now to continue using premium features.',
  },
  {
    threshold: 100,
    severity: 'danger',
    toastType: 'error',
    title: 'Critical Credit Balance',
    description: 'Only {balance} credits left! Actions will be blocked when credits run out.',
  },
];

// ============================================================================
// Threshold Lookup
// ============================================================================

/**
 * Find the current threshold config for a given balance.
 * Returns the tightest (lowest) threshold the balance is at or below.
 * e.g. balance=800 → threshold 1000 (warning), not 2000 (info).
 */
export function getCurrentThreshold(balance: number): CreditThresholdConfig | null {
  if (balance <= 0) return null;

  // Sort ascending so we find the tightest (lowest) matching threshold first
  const sorted = [...CREDIT_THRESHOLD_CONFIGS].sort((a, b) => a.threshold - b.threshold);

  for (const config of sorted) {
    if (balance <= config.threshold) {
      return config;
    }
  }

  return null;
}

// ============================================================================
// Badge Colors (CreditBalance component)
//
// Colors are aligned with alert severity:
//   info     -> blue      (≤ 2000)
//   warning  -> amber     (≤ 1000)
//   critical -> orange    (≤ 500)
//   danger   -> red+pulse (≤ 100)
//   healthy  -> emerald   (> 2000)
// ============================================================================

const BADGE_COLORS: Record<CreditWarningSeverity, BadgeColorClasses> = {
  info: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  warning: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  critical: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  danger: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', extra: 'animate-pulse' },
};

const HEALTHY_BADGE = { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };

/**
 * Get Tailwind color classes for the CreditBalance badge based on amount.
 * Colors align with alert banner severity levels.
 */
export function getBadgeColorClass(amount: number): string {
  const threshold = getCurrentThreshold(amount);
  const colors = threshold ? BADGE_COLORS[threshold.severity] : HEALTHY_BADGE;
  const parts = [colors.text, colors.bg, colors.border];
  if ('extra' in colors && colors.extra) parts.push(colors.extra);
  return parts.join(' ');
}

// ============================================================================
// Alert Severity Styles (CreditAlertBanner component)
// ============================================================================

export function getAlertSeverityStyles(severity: CreditWarningSeverity): AlertSeverityStyles {
  switch (severity) {
    case 'info':
      return {
        variant: 'default',
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-500/5',
        borderColor: 'border-blue-500/20',
      };
    case 'warning':
      return {
        variant: 'default',
        iconColor: 'text-amber-500',
        bgColor: 'bg-amber-500/5',
        borderColor: 'border-amber-500/20',
      };
    case 'critical':
      return {
        variant: 'default',
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-500/5',
        borderColor: 'border-orange-500/20',
      };
    case 'danger':
      return {
        variant: 'destructive',
        iconColor: 'text-red-500',
        bgColor: 'bg-red-500/5',
        borderColor: 'border-red-500/20',
      };
  }
}

// ============================================================================
// Warning Messages (useCredits toast notifications)
// ============================================================================

/**
 * Get warning message for toast notifications based on threshold level.
 */
export function getWarningMessage(
  threshold: number,
  balance: number
): { title: string; description: string; toastType: CreditToastType } | null {
  const config = CREDIT_THRESHOLD_CONFIGS.find((c) => c.threshold === threshold);
  if (!config) return null;

  return {
    title: config.title,
    description: config.description
      .replace('{balance}', balance.toLocaleString()),
    toastType: config.toastType,
  };
}

/**
 * Custom event name dispatched when a credit warning toast's "Buy Credits" button is clicked.
 * Listened for by CreditContext to open the purchase modal.
 */
export const CREDIT_PURCHASE_EVENT = 'floraiq:open-credit-purchase';
