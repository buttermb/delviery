import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { productionLogger } from '@/utils/productionLogger';

// Helper to coerce env strings like "true" | "1" | true into boolean
function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  if (typeof v === 'number') return v === 1;
  return fallback;
}

// Check if we're in development mode - these dangerous flags should NEVER be enabled in production
const isDevelopment = (import.meta as any).env?.MODE === 'development' ||
  (import.meta as any).env?.DEV === true ||
  (import.meta as any).env?.NODE_ENV === 'development';

// Helper that only allows dangerous flag values in development
function toBoolDevOnly(v: unknown): boolean {
  if (!isDevelopment) {
    return false; // Always return false in production for security
  }
  return toBool(v, false);
}

export type FeatureFlags = {
  AUTO_APPROVE_ALL: boolean;
  AUTO_APPROVE_ORDERS: boolean;
  AUTO_APPROVE_LISTINGS: boolean;
  AUTO_APPROVE_SIGNUPS: boolean;
  AUTO_APPROVE_COURIERS: boolean;
  AUTO_APPROVE_REVIEWS: boolean;
  AUTO_BYPASS_EMAIL_VERIFICATION: boolean;
};

// SECURITY: AUTO_APPROVE_* and AUTO_BYPASS_* flags are only allowed in development mode.
// These flags bypass critical security checks and must never be enabled in production.
const envDefaults: FeatureFlags = {
  AUTO_APPROVE_ALL: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_APPROVE_ALL),
  AUTO_APPROVE_ORDERS: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_APPROVE_ORDERS),
  AUTO_APPROVE_LISTINGS: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_APPROVE_LISTINGS),
  AUTO_APPROVE_SIGNUPS: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_APPROVE_SIGNUPS),
  AUTO_APPROVE_COURIERS: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_APPROVE_COURIERS),
  AUTO_APPROVE_REVIEWS: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_APPROVE_REVIEWS),
  AUTO_BYPASS_EMAIL_VERIFICATION: toBoolDevOnly((import.meta as any).env?.VITE_AUTO_BYPASS_EMAIL_VERIFICATION),
};

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  refreshFlags: () => Promise<void>;
  shouldAutoApprove: (entity?: 'ORDERS' | 'LISTINGS' | 'SIGNUPS' | 'COURIERS' | 'REVIEWS') => boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

// List of dangerous flag keys that must only be enabled in development
const DANGEROUS_FLAG_KEYS: (keyof FeatureFlags)[] = [
  'AUTO_APPROVE_ALL',
  'AUTO_APPROVE_ORDERS',
  'AUTO_APPROVE_LISTINGS',
  'AUTO_APPROVE_SIGNUPS',
  'AUTO_APPROVE_COURIERS',
  'AUTO_APPROVE_REVIEWS',
  'AUTO_BYPASS_EMAIL_VERIFICATION',
];

// Sanitize runtime flags to prevent dangerous flags from being enabled in production
function sanitizeRuntimeFlags(flags: Partial<FeatureFlags>): Partial<FeatureFlags> {
  if (isDevelopment) {
    return flags; // Allow all flags in development
  }

  // In production, force all dangerous flags to false
  const sanitized = { ...flags };
  for (const key of DANGEROUS_FLAG_KEYS) {
    if (key in sanitized) {
      sanitized[key] = false;
    }
  }
  return sanitized;
}

async function fetchRuntimeFlags(): Promise<Partial<FeatureFlags>> {
  try {
    const url = `/runtime-flags.json?ts=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Partial<FeatureFlags>;
    // SECURITY: Sanitize dangerous flags in production
    return sanitizeRuntimeFlags(json);
  } catch (_e) {
    return {};
  }
}

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(envDefaults);
  const hasLoggedRef = useRef(false);

  const refreshFlags = async () => {
    const runtime = await fetchRuntimeFlags();
    setFlags((prev) => ({ ...prev, ...runtime } as FeatureFlags));
  };

  useEffect(() => {
    // Load runtime overrides once on mount
    refreshFlags();
     
  }, []);

  useEffect(() => {
    // One-time log when auto-approve is active
    const anyOn = flags.AUTO_APPROVE_ALL ||
      flags.AUTO_APPROVE_ORDERS ||
      flags.AUTO_APPROVE_LISTINGS ||
      flags.AUTO_APPROVE_SIGNUPS ||
      flags.AUTO_APPROVE_COURIERS ||
      flags.AUTO_APPROVE_REVIEWS;
    if (anyOn && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      try {
        productionLogger.warning('Auto-Approve mode is ACTIVE', flags as unknown as Record<string, unknown>);
      } catch {}
    }
  }, [flags]);

  const shouldAutoApprove = useMemo(() => {
    return (entity?: 'ORDERS' | 'LISTINGS' | 'SIGNUPS' | 'COURIERS' | 'REVIEWS') => {
      if (flags.AUTO_APPROVE_ALL) return true;
      switch (entity) {
        case 'ORDERS': return flags.AUTO_APPROVE_ORDERS;
        case 'LISTINGS': return flags.AUTO_APPROVE_LISTINGS;
        case 'SIGNUPS': return flags.AUTO_APPROVE_SIGNUPS;
        case 'COURIERS': return flags.AUTO_APPROVE_COURIERS;
        case 'REVIEWS': return flags.AUTO_APPROVE_REVIEWS;
        default: return flags.AUTO_APPROVE_ALL;
      }
    };
  }, [flags]);

  const value = useMemo<FeatureFlagsContextValue>(() => ({ flags, refreshFlags, shouldAutoApprove }), [flags, shouldAutoApprove]);

  // Avoid JSX in .ts file to keep compatibility with current tsconfig settings
  return React.createElement(FeatureFlagsContext.Provider, { value }, children as any);
};

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return ctx;
}

// Simple helper to construct default approval fields for mutations when enabled.
export function buildAutoApproveDefaults(flags: FeatureFlags): Record<string, unknown> {
  // Non-destructive: callers can pick the fields they need.
  return {
    status: 'approved',
    approved: true,
    approval_status: 'approved',
    autoApprovedAt: new Date().toISOString(),
  };
}
