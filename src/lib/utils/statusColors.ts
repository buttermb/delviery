/**
 * Status Color Utilities
 * Provides semantic color classes for tenant status, health scores, and subscription plans
 * Uses design system tokens from src/index.css
 */

/**
 * Get color classes for tenant/subscription status
 */
export function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    // Tenant Status
    active: 'bg-success/10 text-success border-success/20',
    trial: 'bg-info/10 text-info border-info/20',
    trialing: 'bg-info/10 text-info border-info/20',
    past_due: 'bg-warning/10 text-warning border-warning/20',
    suspended: 'bg-destructive/10 text-destructive border-destructive/20',
    cancelled: 'bg-muted text-muted-foreground border-border',
    canceled: 'bg-muted text-muted-foreground border-border',
    
    // Processing states
    processing: 'bg-info/10 text-info border-info/20',
    pending: 'bg-info/10 text-info border-info/20',
  };

  return statusMap[status.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
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
  const statusMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    trial: 'secondary',
    trialing: 'secondary',
    past_due: 'secondary',
    suspended: 'destructive',
    cancelled: 'outline',
    canceled: 'outline',
  };

  return statusMap[status.toLowerCase()] || 'secondary';
}

