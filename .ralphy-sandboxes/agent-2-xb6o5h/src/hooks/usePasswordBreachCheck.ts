/**
 * Hook for checking passwords against known data breaches.
 * Debounces the API call and provides loading/result state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { checkPasswordBreach, generateStrongPassword, type BreachCheckResult } from '@/lib/security/passwordBreach';

interface UsePasswordBreachCheckOptions {
  /** Debounce delay in ms before checking (default: 800) */
  debounceMs?: number;
  /** Minimum password length before checking (default: 8) */
  minLength?: number;
}

interface UsePasswordBreachCheckReturn {
  /** Whether the breach check is currently running */
  checking: boolean;
  /** Result of the breach check, null if not yet checked */
  result: BreachCheckResult | null;
  /** Generate a strong password suggestion */
  suggestPassword: () => string;
  /** Manually trigger a breach check */
  checkPassword: (password: string) => Promise<BreachCheckResult>;
  /** Reset the check state */
  reset: () => void;
}

export function usePasswordBreachCheck(
  password: string,
  options: UsePasswordBreachCheckOptions = {}
): UsePasswordBreachCheckReturn {
  const { debounceMs = 800, minLength = 8 } = options;

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<BreachCheckResult | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  // Reset when password changes significantly
  useEffect(() => {
    if (!password || password.length < minLength) {
      setResult(null);
      setChecking(false);
      return;
    }

    // Mark any in-flight request as stale
    abortRef.current = true;
    setChecking(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      abortRef.current = false;
      try {
        const checkResult = await checkPasswordBreach(password);
        if (!abortRef.current) {
          setResult(checkResult);
        }
      } finally {
        if (!abortRef.current) {
          setChecking(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      abortRef.current = true;
    };
  }, [password, debounceMs, minLength]);

  const suggestPassword = useCallback((): string => {
    return generateStrongPassword(16);
  }, []);

  const checkPassword = useCallback(async (pw: string): Promise<BreachCheckResult> => {
    setChecking(true);
    try {
      const checkResult = await checkPasswordBreach(pw);
      setResult(checkResult);
      return checkResult;
    } finally {
      setChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setChecking(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    checking,
    result,
    suggestPassword,
    checkPassword,
    reset,
  };
}
