import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordRequirement {
  label: string;
  key: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 8 characters', key: 'length', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter', key: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', key: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { label: 'Number', key: 'number', test: (p) => /\d/.test(p) },
  { label: 'Special character (!@#$%^&*)', key: 'special', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'~`]/.test(p) },
];

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const { passedCount, results, strengthLabel } = useMemo(() => {
    if (!password) {
      return { passedCount: 0, results: [], strengthLabel: '' };
    }

    const results = PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      passed: req.test(password),
    }));

    const passedCount = results.filter((r) => r.passed).length;
    const total = PASSWORD_REQUIREMENTS.length;

    let strengthLabel = '';
    if (passedCount === total) {
      strengthLabel = 'Very strong';
    } else if (passedCount >= 4) {
      strengthLabel = 'Strong';
    } else if (passedCount >= 3) {
      strengthLabel = 'Moderate';
    } else if (passedCount >= 2) {
      strengthLabel = 'Weak';
    } else {
      strengthLabel = 'Very weak';
    }

    return { passedCount, results, strengthLabel };
  }, [password]);

  if (!password) return null;

  const percentage = (passedCount / PASSWORD_REQUIREMENTS.length) * 100;

  return (
    <div className={cn('space-y-3', className)} role="status" aria-live="polite">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Password strength</span>
          <span
            className={cn('text-xs font-medium', {
              'text-red-600': passedCount <= 1,
              'text-orange-600': passedCount === 2,
              'text-yellow-600': passedCount === 3,
              'text-green-600': passedCount === 4,
              'text-green-700': passedCount === 5,
            })}
          >
            {strengthLabel}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300 ease-out',
              {
                'bg-red-500': passedCount <= 1,
                'bg-orange-500': passedCount === 2,
                'bg-yellow-500': passedCount === 3,
                'bg-green-500': passedCount === 4,
                'bg-green-600': passedCount === 5,
              }
            )}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Password strength: ${strengthLabel}`}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1" aria-label="Password requirements">
        {results.map((req) => (
          <li key={req.key} className="flex items-center gap-2 text-xs">
            {req.passed ? (
              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden="true" />
            )}
            <span
              className={cn(
                'transition-colors duration-200',
                req.passed ? 'text-green-700' : 'text-muted-foreground'
              )}
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
