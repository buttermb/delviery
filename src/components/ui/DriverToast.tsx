/**
 * Driver-specific toast helpers that wrap sonner with consistent styling.
 *
 * Usage:
 *   import { driverToast } from '@/components/ui/DriverToast';
 *   driverToast.success('Driver activated');
 *   driverToast.error('Failed to load', { action: { label: 'Retry', onClick: retry } });
 */

import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  action?: ToastAction;
  duration?: number;
}

const DEFAULT_DURATION = 4000;

// ---------------------------------------------------------------------------
// Custom toast rendering
// ---------------------------------------------------------------------------

function renderToast(
  variant: 'success' | 'warning' | 'error' | 'info',
  message: string,
  options?: ToastOptions,
) {
  const { action, duration = DEFAULT_DURATION } = options ?? {};

  const config = {
    success: { border: '#10B981', iconPath: 'M5 13l4 4L19 7' },
    warning: {
      border: '#F59E0B',
      iconPath: 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z',
    },
    error: {
      border: '#EF4444',
      iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    info: {
      border: '#3B82F6',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  }[variant];

  return toast.custom(
    (id) => (
      <div
        className="flex w-[360px] items-center gap-3 rounded-lg border border-[#334155] bg-[#1E293B] px-4 py-3 shadow-xl"
        style={{ borderLeftWidth: 3, borderLeftColor: config.border }}
      >
        {/* Icon */}
        <svg
          className="h-4 w-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke={config.border}
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={config.iconPath} />
        </svg>

        {/* Content */}
        <span className="flex-1 text-sm text-[#F8FAFC]">{message}</span>

        {/* Action */}
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              toast.dismiss(id);
            }}
            className="flex-shrink-0 text-xs font-medium hover:underline"
            style={{ color: config.border }}
          >
            {action.label}
          </button>
        )}

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#64748B] hover:text-[#F8FAFC]"
          aria-label="Dismiss"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ),
    { duration },
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const driverToast = {
  success: (message: string, options?: ToastOptions) =>
    renderToast('success', message, options),
  warning: (message: string, options?: ToastOptions) =>
    renderToast('warning', message, options),
  error: (message: string, options?: ToastOptions) =>
    renderToast('error', message, options),
  info: (message: string, options?: ToastOptions) =>
    renderToast('info', message, options),
};
