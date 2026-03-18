import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  action,
}: SettingsSectionProps) {
  return (
    <div className={cn('space-y-4 sm:space-y-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />}
            <h3 className="text-base sm:text-lg font-semibold tracking-tight truncate">{title}</h3>
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="space-y-3 sm:space-y-4">{children}</div>
    </div>
  );
}

interface SettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg sm:rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md',
        // Responsive padding - smaller on mobile
        'p-4 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** If true, children will take full width on mobile */
  fullWidthOnMobile?: boolean;
}

export function SettingsRow({
  label,
  description,
  children,
  className,
  fullWidthOnMobile = true,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 py-4 border-b last:border-0 last:pb-0 first:pt-0',
        // On larger screens, side-by-side layout
        'sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="space-y-0.5 min-w-0 flex-shrink-0 sm:flex-1">
        <label className="text-sm font-medium block">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div 
        className={cn(
          'flex items-center gap-2',
          // Full width on mobile if specified
          fullWidthOnMobile && 'w-full sm:w-auto',
          // Children should expand to fill on mobile
          fullWidthOnMobile && '[&>*]:flex-1 sm:[&>*]:flex-none'
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface SaveStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
}

export function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <span
      className={cn(
        'text-xs font-medium transition-opacity animate-in fade-in whitespace-nowrap',
        status === 'saving' && 'text-muted-foreground',
        status === 'saved' && 'text-emerald-600',
        status === 'error' && 'text-destructive'
      )}
    >
      {status === 'saving' && 'Saving...'}
      {status === 'saved' && '✓ Saved'}
      {status === 'error' && '✕ Error'}
    </span>
  );
}

/** 
 * Wrapper for form inputs in settings to ensure consistent mobile behavior 
 */
interface SettingsInputGroupProps {
  children: ReactNode;
  className?: string;
}

export function SettingsInputGroup({ children, className }: SettingsInputGroupProps) {
  return (
    <div 
      className={cn(
        'flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3',
        'w-full sm:w-auto',
        className
      )}
    >
      {children}
    </div>
  );
}
