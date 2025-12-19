/**
 * Status Color Utilities
 * Provides semantic color classes for all status types across the application
 * Uses design system tokens from src/index.css
 * 
 * IMPORTANT: All colors use semantic tokens (success, warning, destructive, info, muted)
 * instead of hardcoded colors (green-500, yellow-500, red-500, blue-500)
 */

export type StatusColorConfig = {
  bg: string;
  text: string;
  border: string;
  className: string;
};

/**
 * Comprehensive status color mapping using semantic tokens
 */
const STATUS_COLORS: Record<string, StatusColorConfig> = {
  // Success states (green semantic)
  active: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  completed: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  delivered: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  paid: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  approved: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  confirmed: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  in_stock: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  good: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  healthy: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  online: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  enabled: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  ready: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', className: 'bg-success/10 text-success border-success/20' },
  
  // Warning states (amber/yellow semantic)
  pending: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  processing: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  preparing: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  scheduled: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  in_progress: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  low_stock: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  low: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  soft_burned: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  partial: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  past_due: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  at_risk: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  in_transit: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  ready_for_pickup: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', className: 'bg-warning/10 text-warning border-warning/20' },
  
  // Error/Destructive states (red semantic)
  failed: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  canceled: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  rejected: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  error: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  overdue: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  out_of_stock: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  out: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  hard_burned: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  suspended: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  blocked: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  offline: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  disabled: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  critical: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  
  // Info states (blue semantic)
  draft: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  new: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  info: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  trial: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  trialing: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  open: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  medium: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', className: 'bg-info/10 text-info border-info/20' },
  
  // Neutral/Muted states
  default: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', className: 'bg-muted text-muted-foreground border-border' },
  inactive: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', className: 'bg-muted text-muted-foreground border-border' },
  expired: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', className: 'bg-muted text-muted-foreground border-border' },
  closed: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', className: 'bg-muted text-muted-foreground border-border' },
  archived: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', className: 'bg-muted text-muted-foreground border-border' },
  unknown: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', className: 'bg-muted text-muted-foreground border-border' },
};

const DEFAULT_STATUS: StatusColorConfig = {
  bg: 'bg-muted',
  text: 'text-muted-foreground', 
  border: 'border-border',
  className: 'bg-muted text-muted-foreground border-border'
};

/**
 * Get color configuration for a status
 */
export function getStatusColorConfig(status: string): StatusColorConfig {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  return STATUS_COLORS[normalized] || DEFAULT_STATUS;
}

/**
 * Get combined className for status (bg + text + border)
 */
export function getStatusColor(status: string): string {
  return getStatusColorConfig(status).className;
}

/**
 * Get badge variant for subscription plan
 */
export function getPlanVariant(plan: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const planMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    starter: 'secondary',
    professional: 'default',
    enterprise: 'outline',
  };

  return planMap[plan.toLowerCase()] || 'secondary';
}

/**
 * Get color classes for health score
 * Returns semantic color classes based on score ranges
 */
export function getHealthColor(score: number): string {
  if (score >= 80) {
    return 'bg-success/10 text-success border-success/20';
  } else if (score >= 50) {
    return 'bg-warning/10 text-warning border-warning/20';
  } else {
    return 'bg-destructive/10 text-destructive border-destructive/20';
  }
}

/**
 * Get text color class for health score
 */
export function getHealthTextColor(score: number): string {
  if (score >= 80) {
    return 'text-success';
  } else if (score >= 50) {
    return 'text-warning';
  } else {
    return 'text-destructive';
  }
}

/**
 * Get health label based on score
 */
export function getHealthLabel(score: number): string {
  if (score >= 80) {
    return 'Healthy';
  } else if (score >= 50) {
    return 'Warning';
  } else {
    return 'At Risk';
  }
}

/**
 * Get health variant for badges
 */
export function getHealthVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) {
    return 'default';
  } else if (score >= 50) {
    return 'secondary';
  } else {
    return 'destructive';
  }
}

/**
 * Get status variant for badges
 */
export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  
  // Success states
  if (['active', 'completed', 'delivered', 'paid', 'approved', 'confirmed', 'success', 'in_stock', 'good', 'healthy', 'online', 'enabled', 'ready'].includes(normalized)) {
    return 'default';
  }
  
  // Warning states
  if (['pending', 'processing', 'preparing', 'scheduled', 'in_progress', 'low_stock', 'low', 'warning', 'soft_burned', 'partial', 'past_due', 'at_risk', 'in_transit', 'ready_for_pickup'].includes(normalized)) {
    return 'secondary';
  }
  
  // Destructive states
  if (['failed', 'cancelled', 'canceled', 'rejected', 'error', 'overdue', 'out_of_stock', 'out', 'hard_burned', 'suspended', 'blocked', 'offline', 'disabled', 'critical', 'high'].includes(normalized)) {
    return 'destructive';
  }
  
  return 'outline';
}

/**
 * Get severity color config for alerts
 */
export function getSeverityColor(severity: 'critical' | 'high' | 'medium' | 'low' | string): StatusColorConfig {
  const severityMap: Record<string, string> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'good',
  };
  
  return getStatusColorConfig(severityMap[severity.toLowerCase()] || 'default');
}
