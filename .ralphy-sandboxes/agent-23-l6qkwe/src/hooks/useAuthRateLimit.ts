import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

interface RateLimitState {
  attemptCount: number;
  lastAttemptTime: number;
  lockedUntil: number | null;
}

interface UseAuthRateLimitOptions {
  /** sessionStorage key to persist state across page refresh */
  storageKey: string;
  /** Maximum attempts before lockout (default: 5) */
  maxAttempts?: number;
  /** Base delay in seconds for exponential backoff (default: 15) */
  baseDelay?: number;
  /** Maximum lockout duration in seconds (default: 300 = 5 minutes) */
  maxDelay?: number;
}

interface UseAuthRateLimitReturn {
  /** Whether the user is currently locked out */
  isLocked: boolean;
  /** Remaining seconds until lockout expires (0 if not locked) */
  remainingSeconds: number;
  /** Number of failed attempts so far */
  attemptCount: number;
  /** Call when a login/signup attempt is made (increments counter) */
  recordAttempt: () => void;
  /** Call on successful login/signup (resets state) */
  resetOnSuccess: () => void;
}

const getStoredState = (key: string): RateLimitState => {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as RateLimitState;
    }
  } catch {
    // sessionStorage unavailable or parse error
  }
  return { attemptCount: 0, lastAttemptTime: 0, lockedUntil: null };
};

const persistState = (key: string, state: RateLimitState): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable
  }
};

const clearStoredState = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sessionStorage unavailable
  }
};

/**
 * Calculates lockout duration using exponential backoff.
 * After maxAttempts: baseDelay * 2^(excess attempts - 1), capped at maxDelay.
 */
const calculateLockoutDuration = (
  attemptCount: number,
  maxAttempts: number,
  baseDelay: number,
  maxDelay: number
): number => {
  if (attemptCount < maxAttempts) return 0;
  const excessAttempts = attemptCount - maxAttempts;
  const delay = baseDelay * Math.pow(2, excessAttempts);
  return Math.min(delay, maxDelay);
};

export function useAuthRateLimit({
  storageKey,
  maxAttempts = 5,
  baseDelay = 15,
  maxDelay = 300,
}: UseAuthRateLimitOptions): UseAuthRateLimitReturn {
  const [state, setState] = useState<RateLimitState>(() => getStoredState(storageKey));
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateRemaining = useCallback(() => {
    if (state.lockedUntil) {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        // Lockout expired, clear lockedUntil but keep attemptCount
        const newState: RateLimitState = { ...state, lockedUntil: null };
        setState(newState);
        persistState(storageKey, newState);
      }
    } else {
      setRemainingSeconds(0);
    }
  }, [state, storageKey]);

  // Start/stop countdown timer
  useEffect(() => {
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      updateRemaining();
      timerRef.current = setInterval(updateRemaining, 1000);
    } else {
      setRemainingSeconds(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.lockedUntil, updateRemaining]);

  const recordAttempt = useCallback(() => {
    const newCount = state.attemptCount + 1;
    const now = Date.now();
    const lockoutDuration = calculateLockoutDuration(newCount, maxAttempts, baseDelay, maxDelay);

    const newState: RateLimitState = {
      attemptCount: newCount,
      lastAttemptTime: now,
      lockedUntil: lockoutDuration > 0 ? now + lockoutDuration * 1000 : null,
    };

    setState(newState);
    persistState(storageKey, newState);

    if (lockoutDuration > 0) {
      logger.warn('Auth rate limit triggered', {
        storageKey,
        attemptCount: newCount,
        lockoutSeconds: lockoutDuration,
      });
    }
  }, [state.attemptCount, maxAttempts, baseDelay, maxDelay, storageKey]);

  const resetOnSuccess = useCallback(() => {
    setState({ attemptCount: 0, lastAttemptTime: 0, lockedUntil: null });
    setRemainingSeconds(0);
    clearStoredState(storageKey);
  }, [storageKey]);

  const isLocked = remainingSeconds > 0;

  return {
    isLocked,
    remainingSeconds,
    attemptCount: state.attemptCount,
    recordAttempt,
    resetOnSuccess,
  };
}
