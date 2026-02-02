import { Badge, BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusVariant } from '@/lib/utils/statusColors';
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Info from "lucide-react/dist/esm/icons/info";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import Ban from "lucide-react/dist/esm/icons/ban";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import LucideIcon from "lucide-react/dist/esm/icons/lucide-icon";

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  /** The status value to display */
  status: string;
  /** Optional custom label (defaults to formatted status) */
  label?: string;
  /** Show icon alongside text */
  showIcon?: boolean;
  /** Size of the badge */
  size?: 'sm' | 'default' | 'lg';
  /** Use variant-based styling instead of semantic colors */
  useVariant?: boolean;
}

// Map status to appropriate icon
const STATUS_ICONS: Record<string, LucideIcon> = {
  // Success
  active: CheckCircle2,
  completed: CheckCircle2,
  delivered: CheckCircle2,
  paid: CheckCircle2,
  approved: CheckCircle2,
  confirmed: CheckCircle2,
  success: CheckCircle2,
  in_stock: CheckCircle2,
  good: CheckCircle2,
  healthy: CheckCircle2,
  online: CheckCircle2,
  enabled: CheckCircle2,
  ready: CheckCircle2,
  
  // Warning
  pending: Clock,
  processing: Loader2,
  preparing: Loader2,
  scheduled: Clock,
  in_progress: Loader2,
  low_stock: AlertTriangle,
  low: AlertTriangle,
  warning: AlertTriangle,
  soft_burned: AlertTriangle,
  partial: AlertTriangle,
  past_due: AlertTriangle,
  at_risk: AlertTriangle,
  in_transit: Truck,
  ready_for_pickup: Package,
  
  // Error
  failed: XCircle,
  cancelled: Ban,
  canceled: Ban,
  rejected: XCircle,
  error: XCircle,
  overdue: XCircle,
  out_of_stock: XCircle,
  out: XCircle,
  hard_burned: XCircle,
  suspended: Ban,
  blocked: Ban,
  offline: XCircle,
  disabled: Ban,
  critical: AlertTriangle,
  high: AlertTriangle,
  
  // Info
  draft: Info,
  new: Info,
  info: Info,
  trial: Info,
  trialing: Info,
  open: Info,
  medium: Info,
  
  // Neutral
  default: Clock,
  inactive: Clock,
  expired: Clock,
  closed: Ban,
  archived: Clock,
  unknown: Info,
};

// Format status for display
function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StatusBadge({
  status,
  label,
  showIcon = true,
  size = 'default',
  useVariant = false,
  className,
  ...props
}: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  const Icon = STATUS_ICONS[normalized] || Clock;
  const displayLabel = label || formatStatus(status);
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  if (useVariant) {
    return (
      <Badge
        variant={getStatusVariant(status)}
        className={cn(
          'gap-1 font-medium whitespace-nowrap',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {showIcon && <Icon className={cn(iconSizes[size], normalized === 'processing' && 'animate-spin')} />}
        {displayLabel}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium whitespace-nowrap border',
        sizeClasses[size],
        getStatusColor(status),
        className
      )}
      {...props}
    >
      {showIcon && <Icon className={cn(iconSizes[size], normalized === 'processing' && 'animate-spin')} />}
      {displayLabel}
    </Badge>
  );
}

interface StatusDotProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusDot({ 
  status, 
  className,
  size = 'md',
  pulse = false 
}: StatusDotProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  // Get color class based on status
  const colorClass = getStatusColor(status).split(' ')[0].replace('bg-', 'bg-') || 'bg-muted';

  return (
    <span 
      className={cn(
        'inline-block rounded-full',
        colorClass,
        sizeClasses[size],
        pulse && 'animate-pulse',
        className
      )}
      title={status.replace(/_/g, ' ')}
    />
  );
}
