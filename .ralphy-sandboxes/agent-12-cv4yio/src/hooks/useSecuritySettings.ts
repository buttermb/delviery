/**
 * useSecuritySettings Hook
 *
 * Provides security settings for enforcing session timeouts, password requirements,
 * and other security-related configurations throughout the application.
 *
 * Features:
 * - Session timeout enforcement
 * - Password validation based on settings
 * - 2FA status checking
 * - Automatic session refresh/logout on timeout
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  requirePasswordChange: boolean;
  sessionTimeout: number; // in minutes
  passwordMinLength: number;
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  twoFactorEnabled: false,
  requirePasswordChange: false,
  sessionTimeout: 30, // 30 minutes default
  passwordMinLength: 8,
};

// Minimum allowed values for validation
const MIN_SESSION_TIMEOUT = 5; // 5 minutes
const MIN_PASSWORD_LENGTH = 8;
const MAX_SESSION_TIMEOUT = 1440; // 24 hours

/**
 * Hook to access and enforce security settings
 */
export function useSecuritySettings() {
  const { account, loading } = useAccount();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive security settings from account metadata
  const settings = useMemo((): SecuritySettings => {
    if (!account) return DEFAULT_SECURITY_SETTINGS;

    const metadata = (account as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    const securityData = (metadata?.security as Partial<SecuritySettings>) || {};

    return {
      twoFactorEnabled: securityData.twoFactorEnabled ?? DEFAULT_SECURITY_SETTINGS.twoFactorEnabled,
      requirePasswordChange: securityData.requirePasswordChange ?? DEFAULT_SECURITY_SETTINGS.requirePasswordChange,
      sessionTimeout: Math.max(
        MIN_SESSION_TIMEOUT,
        Math.min(MAX_SESSION_TIMEOUT, securityData.sessionTimeout ?? DEFAULT_SECURITY_SETTINGS.sessionTimeout)
      ),
      passwordMinLength: Math.max(
        MIN_PASSWORD_LENGTH,
        securityData.passwordMinLength ?? DEFAULT_SECURITY_SETTINGS.passwordMinLength
      ),
    };
  }, [account]);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check if session has timed out
  const isSessionTimedOut = useCallback((): boolean => {
    const timeoutMs = settings.sessionTimeout * 60 * 1000;
    const elapsed = Date.now() - lastActivityRef.current;
    return elapsed >= timeoutMs;
  }, [settings.sessionTimeout]);

  // Handle session timeout
  const handleSessionTimeout = useCallback(() => {
    if (!user) return;

    logger.info('Session timed out due to inactivity', {
      component: 'useSecuritySettings',
      timeoutMinutes: settings.sessionTimeout,
    });

    toast.warning('Session expired', {
      description: 'You have been logged out due to inactivity.',
    });

    signOut();
    navigate('/login');
  }, [user, settings.sessionTimeout, signOut, navigate]);

  // Set up session timeout monitoring
  useEffect(() => {
    if (!user || settings.sessionTimeout === 0) return;

    // Clear any existing timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    // Set up periodic check for session timeout
    const checkTimeout = () => {
      if (isSessionTimedOut()) {
        handleSessionTimeout();
      } else {
        // Check again in 1 minute
        timeoutIdRef.current = setTimeout(checkTimeout, 60 * 1000);
      }
    };

    // Start checking after the timeout period
    timeoutIdRef.current = setTimeout(checkTimeout, settings.sessionTimeout * 60 * 1000);

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => {
      updateActivity();
      // Reset the timeout check
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(checkTimeout, settings.sessionTimeout * 60 * 1000);
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, settings.sessionTimeout, isSessionTimedOut, handleSessionTimeout, updateActivity]);

  // Validate password against settings
  const validatePassword = useCallback((password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < settings.passwordMinLength) {
      errors.push(`Password must be at least ${settings.passwordMinLength} characters`);
    }

    // Additional password requirements could be added here
    // e.g., require uppercase, lowercase, numbers, special chars

    return {
      valid: errors.length === 0,
      errors,
    };
  }, [settings.passwordMinLength]);

  // Check if 2FA is required
  const is2FARequired = useCallback((): boolean => {
    return settings.twoFactorEnabled;
  }, [settings.twoFactorEnabled]);

  // Check if password change is required
  const isPasswordChangeRequired = useCallback((): boolean => {
    return settings.requirePasswordChange;
  }, [settings.requirePasswordChange]);

  // Get time remaining until session timeout
  const getTimeRemaining = useCallback((): number => {
    const timeoutMs = settings.sessionTimeout * 60 * 1000;
    const elapsed = Date.now() - lastActivityRef.current;
    return Math.max(0, timeoutMs - elapsed);
  }, [settings.sessionTimeout]);

  return {
    settings,
    isLoading: loading,
    // Session management
    updateActivity,
    isSessionTimedOut,
    getTimeRemaining,
    // Password validation
    validatePassword,
    // Feature checks
    is2FARequired,
    isPasswordChangeRequired,
  };
}

/**
 * Hook to check if 2FA is enabled
 */
export function useTwoFactorRequired(): boolean {
  const { is2FARequired } = useSecuritySettings();
  return is2FARequired();
}

/**
 * Hook to get session timeout value
 */
export function useSessionTimeout(): number {
  const { settings } = useSecuritySettings();
  return settings.sessionTimeout;
}

/**
 * Hook to get password minimum length
 */
export function usePasswordMinLength(): number {
  const { settings } = useSecuritySettings();
  return settings.passwordMinLength;
}

/**
 * Hook for password validation using global settings
 */
export function usePasswordValidator() {
  const { validatePassword } = useSecuritySettings();
  return validatePassword;
}
