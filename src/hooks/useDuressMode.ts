/**
 * Duress PIN Hook
 * Detects and handles duress PIN login for security
 */

import { useState, useEffect } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const DURESS_MODE_KEY = 'duress_mode';
const DURESS_PIN_PREFIX = '999'; // Duress PINs start with 999

/**
 * Check if a PIN/password is a duress PIN
 */
export function isDuressPIN(pin: string): boolean {
  // Duress PINs start with 999 (configurable)
  return pin.startsWith(DURESS_PIN_PREFIX);
}

/**
 * Hook to manage duress mode state
 * In duress mode, the app shows decoy/fake data instead of real data
 */
export function useDuressMode() {
  const { tenant } = useTenantAdminAuth();
  const [isDuressMode, setIsDuressMode] = useState(false);

  useEffect(() => {
    // Check if duress mode is active in sessionStorage
    const mode = sessionStorage.getItem(DURESS_MODE_KEY);
    setIsDuressMode(mode === 'true');
  }, []);

  /**
   * Activate duress mode
   * This should be called when a duress PIN is detected during login
   */
  const activateDuressMode = () => {
    sessionStorage.setItem(DURESS_MODE_KEY, 'true');
    setIsDuressMode(true);
    
    // Log the security event (silently)
    if (tenant?.id) {
      // Call Edge Function to log duress login (non-blocking)
      fetch('/api/log-security-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          event_type: 'duress_login',
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently fail - don't alert attacker
      });
    }
  };

  /**
   * Deactivate duress mode
   */
  const deactivateDuressMode = () => {
    sessionStorage.removeItem(DURESS_MODE_KEY);
    setIsDuressMode(false);
  };

  /**
   * Get fake safe data for duress mode
   * Returns minimal, non-sensitive data
   */
  const getDuressData = <T>(realData: T): T => {
    if (!isDuressMode) return realData;
    
    // Return minimal/decoy data
    // This should be customized per data type
    return {} as T;
  };

  return {
    isDuressMode,
    activateDuressMode,
    deactivateDuressMode,
    getDuressData,
  };
}

/**
 * Use this in query hooks to return decoy data in duress mode
 */
export function useDuressQuery<T>(queryFn: () => Promise<T>, enabled = true) {
  const { isDuressMode, getDuressData } = useDuressMode();

  if (isDuressMode && enabled) {
    // Return decoy data
    return {
      data: getDuressData({} as T),
      isLoading: false,
      error: null,
    };
  }

  // Return normal query (caller should use useQuery normally)
  return null;
}

