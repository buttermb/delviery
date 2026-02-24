/**
 * Password Breach Warning Component
 * Displays breach check status and allows generating a strong password.
 */

import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, ShieldX, Loader2, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { showCopyToast } from '@/utils/toastHelpers';
import type { BreachCheckResult } from '@/lib/security/passwordBreach';

interface PasswordBreachWarningProps {
  /** Whether the breach check is in progress */
  checking: boolean;
  /** The breach check result */
  result: BreachCheckResult | null;
  /** Callback to generate and apply a suggested password */
  onGeneratePassword?: (password: string) => void;
  /** Function to generate a strong password */
  suggestPassword: () => string;
  /** Additional class names */
  className?: string;
}

export function PasswordBreachWarning({
  checking,
  result,
  onGeneratePassword,
  suggestPassword,
  className,
}: PasswordBreachWarningProps) {
  const [suggestedPassword, setSuggestedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleGenerate = () => {
    const password = suggestPassword();
    setSuggestedPassword(password);
    setCopied(false);
  };

  const handleUsePassword = () => {
    if (suggestedPassword && onGeneratePassword) {
      onGeneratePassword(suggestedPassword);
      setSuggestedPassword(null);
      setCopied(false);
    }
  };

  const handleCopy = async () => {
    if (suggestedPassword) {
      await navigator.clipboard.writeText(suggestedPassword);
      setCopied(true);
      showCopyToast('Password');
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  if (checking) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground py-1', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking password security...</span>
      </div>
    );
  }

  if (!result) return null;

  // Password is safe
  if (!result.breached) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-green-600 dark:text-green-400 py-1', className)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>No known breaches found</span>
      </div>
    );
  }

  // Password is breached but not blocked (warning)
  if (result.breached && !result.blocked) {
    return (
      <div className={cn('space-y-2 py-1', className)}>
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{result.message}</span>
        </div>
        {onGeneratePassword && (
          <PasswordSuggestion
            suggestedPassword={suggestedPassword}
            copied={copied}
            onGenerate={handleGenerate}
            onUse={handleUsePassword}
            onCopy={handleCopy}
          />
        )}
      </div>
    );
  }

  // Password is blocked (too commonly breached)
  return (
    <div className={cn('space-y-2 py-1', className)}>
      <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
        <ShieldX className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{result.message}</span>
      </div>
      {onGeneratePassword && (
        <PasswordSuggestion
          suggestedPassword={suggestedPassword}
          copied={copied}
          onGenerate={handleGenerate}
          onUse={handleUsePassword}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}

interface PasswordSuggestionProps {
  suggestedPassword: string | null;
  copied: boolean;
  onGenerate: () => void;
  onUse: () => void;
  onCopy: () => void;
}

function PasswordSuggestion({ suggestedPassword, copied, onGenerate, onUse, onCopy }: PasswordSuggestionProps) {
  if (!suggestedPassword) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onGenerate}
      >
        <RefreshCw className="h-3 w-3" />
        Generate strong password
      </Button>
    );
  }

  return (
    <div className="bg-muted/50 rounded-md p-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono bg-background px-2 py-1 rounded border flex-1 truncate">
          {suggestedPassword}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onCopy}
          title="Copy password"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 text-xs"
          onClick={onUse}
        >
          Use this password
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={onGenerate}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          New
        </Button>
        {copied && (
          <span className="text-xs text-green-600">Copied!</span>
        )}
      </div>
    </div>
  );
}
