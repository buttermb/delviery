/**
 * Password Strength Indicator Component
 * Shows visual feedback for password strength with Weak/Medium/Strong levels
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
  /** If true, shows detailed requirements checklist */
  showRequirements?: boolean;
}

interface StrengthCheck {
  label: string;
  test: (password: string) => boolean;
}

const strengthChecks: StrengthCheck[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Contains number', test: (p) => /\d/.test(p) },
  { label: 'Contains special character', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/'~`]/.test(p) },
];

type StrengthLevel = 'weak' | 'medium' | 'strong';

interface StrengthResult {
  level: StrengthLevel;
  label: string;
  score: number;
}

/**
 * Calculate password strength based on criteria checks
 * Returns: weak (0-2 checks), medium (3-4 checks), strong (5 checks)
 */
export function calculatePasswordStrength(password: string): StrengthResult {
  if (!password) {
    return { level: 'weak', label: '', score: 0 };
  }

  const passedChecks = strengthChecks.filter(check => check.test(password)).length;

  if (passedChecks <= 2) {
    return { level: 'weak', label: 'Weak', score: passedChecks };
  } else if (passedChecks <= 4) {
    return { level: 'medium', label: 'Medium', score: passedChecks };
  } else {
    return { level: 'strong', label: 'Strong', score: passedChecks };
  }
}

export function PasswordStrengthIndicator({
  password,
  className,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  if (!password) return null;

  const strengthColors = {
    weak: {
      bar: 'bg-red-500',
      text: 'text-red-600',
    },
    medium: {
      bar: 'bg-yellow-500',
      text: 'text-yellow-600',
    },
    strong: {
      bar: 'bg-green-500',
      text: 'text-green-600',
    },
  };

  const colors = strengthColors[strength.level];

  return (
    <div className={cn('space-y-2', className)} role="status" aria-live="polite">
      {/* Visual Strength Meter - 3 bars for Weak/Medium/Strong */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {(['weak', 'medium', 'strong'] as StrengthLevel[]).map((level) => {
            // Determine if this bar should be filled
            const levelOrder: Record<StrengthLevel, number> = { weak: 0, medium: 1, strong: 2 };
            const currentLevelOrder = levelOrder[strength.level];
            const thisLevelOrder = levelOrder[level];
            const isFilled = thisLevelOrder <= currentLevelOrder;

            return (
              <div
                key={level}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-200',
                  isFilled ? colors.bar : 'bg-gray-200'
                )}
                role="progressbar"
                aria-valuenow={isFilled ? 100 : 0}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            );
          })}
        </div>
        {strength.label && (
          <p className={cn('text-xs font-medium', colors.text)}>
            Password strength: {strength.label}
          </p>
        )}
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1">
          {strengthChecks.map((check, index) => {
            const passed = check.test(password);
            return (
              <div key={index} className="flex items-center gap-2 text-xs">
                {passed ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle className="h-3 w-3 text-gray-400 shrink-0" aria-hidden="true" />
                )}
                <span className={cn(
                  'transition-colors duration-200',
                  passed ? 'text-green-600' : 'text-gray-500'
                )}>
                  {check.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
