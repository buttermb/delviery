import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

interface RateLimitWarningProps {
  remainingSeconds: number;
  className?: string;
  /** Visual variant matching the form's design system */
  variant?: 'dark' | 'light';
}

function formatTimeRemaining(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

export function RateLimitWarning({ remainingSeconds, className = '', variant = 'light' }: RateLimitWarningProps) {
  if (remainingSeconds <= 0) return null;

  const darkStyles = 'bg-red-900/30 border-red-700/50 text-red-200';
  const lightStyles = 'bg-red-50 border-red-200 text-red-800';
  const variantStyles = variant === 'dark' ? darkStyles : lightStyles;

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${variantStyles} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <span>
        Too many attempts. Please try again in{' '}
        <span className="font-semibold">{formatTimeRemaining(remainingSeconds)}</span>.
      </span>
    </div>
  );
}
