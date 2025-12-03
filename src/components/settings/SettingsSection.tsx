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
    <div className={cn('space-y-6', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
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
        'rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md',
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
}

export function SettingsRow({
  label,
  description,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b last:border-0 last:pb-0 first:pt-0',
        className
      )}
    >
      <div className="space-y-0.5 flex-1">
        <label className="text-sm font-medium">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
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
        'text-xs font-medium transition-opacity animate-in fade-in',
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

