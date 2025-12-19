/**
 * Password Strength Indicator Component
 * Shows visual feedback for password strength
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
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
  { label: 'Contains special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };

    const passedChecks = strengthChecks.filter(check => check.test(password)).length;
    const totalChecks = strengthChecks.length;
    const percentage = (passedChecks / totalChecks) * 100;

    if (percentage < 40) {
      return { score: 1, label: 'Weak', color: 'bg-red-500' };
    } else if (percentage < 60) {
      return { score: 2, label: 'Fair', color: 'bg-orange-500' };
    } else if (percentage < 80) {
      return { score: 3, label: 'Good', color: 'bg-yellow-500' };
    } else if (percentage < 100) {
      return { score: 4, label: 'Strong', color: 'bg-green-500' };
    } else {
      return { score: 5, label: 'Very Strong', color: 'bg-green-600' };
    }
  }, [password]);

  if (!password) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Strength Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', strength.color)}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
        <span className={cn('text-xs font-medium', {
          'text-red-600': strength.score <= 1,
          'text-orange-600': strength.score === 2,
          'text-yellow-600': strength.score === 3,
          'text-green-600': strength.score >= 4,
        })}>
          {strength.label}
        </span>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1">
        {strengthChecks.map((check, index) => {
          const passed = check.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              {passed ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-gray-400" />
              )}
              <span className={cn({
                'text-green-600': passed,
                'text-gray-500': !passed,
              })}>
                {check.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
