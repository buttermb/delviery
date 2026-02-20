/**
 * Unified Status Colors
 * Consistent colors for status indicators across the entire admin panel
 */

export const STATUS_COLORS = {
  // Order/Workflow statuses
  pending: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  assigned: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-300 dark:border-indigo-700',
    dot: 'bg-indigo-500',
  },
  confirmed: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    dot: 'bg-blue-500',
  },
  processing: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    dot: 'bg-blue-500',
  },
  ready: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  shipped: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    dot: 'bg-purple-500',
  },
  in_transit: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    dot: 'bg-purple-500',
  },
  delivered: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  completed: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
  },

  // Invoice statuses
  draft: {
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-300 dark:border-gray-700',
    dot: 'bg-gray-500',
  },
  sent: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    dot: 'bg-blue-500',
  },
  void: {
    bg: 'bg-gray-900 dark:bg-gray-100/10',
    text: 'text-white dark:text-gray-300',
    border: 'border-gray-900 dark:border-gray-600',
    dot: 'bg-gray-900 dark:bg-gray-300',
  },

  // Payment statuses
  paid: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  unpaid: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  overdue: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
  },
  partial: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
    dot: 'bg-orange-500',
  },
  partially_paid: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  refunded: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    dot: 'bg-purple-500',
  },

  // Account statuses
  active: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  inactive: {
    bg: 'bg-slate-100 dark:bg-slate-900/30',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  suspended: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
  },
  blocked: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
  },

  // Stock statuses
  in_stock: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  low_stock: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  out_of_stock: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
  },

  // Generic fallback
  default: {
    bg: 'bg-slate-100 dark:bg-slate-900/30',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-500',
  },
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export function getStatusColors(status: string): (typeof STATUS_COLORS)[StatusKey] {
  const normalizedStatus = status.toLowerCase().replace(/[\s-]/g, '_') as StatusKey;
  return STATUS_COLORS[normalizedStatus] || STATUS_COLORS.default;
}

export function getStatusBadgeClasses(status: string): string {
  const colors = getStatusColors(status);
  return `${colors.bg} ${colors.text} ${colors.border}`;
}
