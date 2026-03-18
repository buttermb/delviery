import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

export interface AccountLockInfo {
  isLocked: boolean;
  unlockTime: Date | null;
  remainingSeconds: number;
  email: string;
  tenantSlug: string;
}

interface UseAccountLockStatusOptions {
  email: string;
  tenantSlug: string;
  lockDurationSeconds: number;
  onUnlocked?: () => void;
}

/**
 * Hook to manage account lock status with automatic countdown timer.
 * Tracks when an account is locked due to too many failed login attempts,
 * provides remaining time, and automatically notifies when the lock expires.
 */
export function useAccountLockStatus({
  email,
  tenantSlug,
  lockDurationSeconds,
  onUnlocked,
}: UseAccountLockStatusOptions): AccountLockInfo & {
  setLocked: (durationSeconds: number) => void;
  clearLock: () => void;
} {
  const [isLocked, setIsLocked] = useState(false);
  const [unlockTime, setUnlockTime] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onUnlockedRef = useRef(onUnlocked);

  // Keep callback ref updated
  useEffect(() => {
    onUnlockedRef.current = onUnlocked;
  }, [onUnlocked]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearLock = useCallback(() => {
    clearTimer();
    setIsLocked(false);
    setUnlockTime(null);
    setRemainingSeconds(0);
  }, [clearTimer]);

  const setLocked = useCallback((durationSeconds: number) => {
    clearTimer();

    const unlock = new Date(Date.now() + durationSeconds * 1000);
    setIsLocked(true);
    setUnlockTime(unlock);
    setRemainingSeconds(durationSeconds);

    logger.info('Account locked', { email, tenantSlug, unlockTime: unlock.toISOString() });

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((unlock.getTime() - now) / 1000));

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearTimer();
        setIsLocked(false);
        setUnlockTime(null);
        setRemainingSeconds(0);
        logger.info('Account lock expired', { email, tenantSlug });
        onUnlockedRef.current?.();
      }
    }, 1000);
  }, [email, tenantSlug, clearTimer]);

  // Initialize from provided lockDurationSeconds if > 0
  useEffect(() => {
    if (lockDurationSeconds > 0) {
      setLocked(lockDurationSeconds);
    }
    return clearTimer;
  }, [lockDurationSeconds, setLocked, clearTimer]);

  return {
    isLocked,
    unlockTime,
    remainingSeconds,
    email,
    tenantSlug,
    setLocked,
    clearLock,
  };
}
