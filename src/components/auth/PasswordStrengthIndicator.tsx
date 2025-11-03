import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 25;
    if (password.length >= 12) score += 15;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 15;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    if (score <= 30) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 60) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score <= 80) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password strength:</span>
        <span className={`font-medium ${
          strength.label === 'Weak' ? 'text-red-500' :
          strength.label === 'Fair' ? 'text-yellow-500' :
          strength.label === 'Good' ? 'text-blue-500' :
          'text-green-500'
        }`}>
          {strength.label}
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${strength.color}`}
          style={{ width: `${strength.score}%` }}
        />
      </div>
      {strength.score < 60 && (
        <p className="text-xs text-muted-foreground">
          Use 8+ characters with uppercase, lowercase, numbers & symbols
        </p>
      )}
    </div>
  );
}
