import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BannerVariant = 'critical' | 'stale' | 'offline';

interface ErrorBannerProps {
  variant: BannerVariant;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VARIANT_CONFIG: Record<
  BannerVariant,
  { bg: string; border: string; icon: string; iconColor: string; btnBg: string; btnText: string }
> = {
  critical: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    icon: 'error',
    iconColor: 'text-destructive',
    btnBg: 'bg-destructive hover:bg-red-700',
    btnText: 'text-white',
  },
  stale: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'warning',
    iconColor: 'text-amber-500',
    btnBg: 'bg-amber-500 hover:bg-amber-600',
    btnText: 'text-white',
  },
  offline: {
    bg: 'bg-muted-foreground/10',
    border: 'border-muted-foreground/20',
    icon: 'offline',
    iconColor: 'text-muted-foreground',
    btnBg: '',
    btnText: '',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorBanner({ variant, message, onRetry, onDismiss, className }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const cfg = VARIANT_CONFIG[variant];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3',
        cfg.bg,
        cfg.border,
        className,
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0', cfg.iconColor)}>
        {variant === 'critical' && (
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {variant === 'stale' && (
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        )}
        {variant === 'offline' && (
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414" />
          </svg>
        )}
      </div>

      {/* Message */}
      <p className="flex-1 text-sm text-foreground">{message}</p>

      {/* Retry button */}
      {onRetry && cfg.btnBg && (
        <Button
          size="sm"
          onClick={onRetry}
          className={cn('h-7 text-xs', cfg.btnBg, cfg.btnText)}
        >
          {variant === 'stale' ? 'Refresh' : 'Retry'}
        </Button>
      )}

      {/* Dismiss */}
      {onDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
