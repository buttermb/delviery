import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { productionLogger } from '@/utils/productionLogger';

// Helper to coerce env strings like "true" | "1" | true into boolean
function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  if (typeof v === 'number') return v === 1;
  return fallback;
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

const envDefaults: FeatureFlags = {
  AUTO_APPROVE_ALL: toBool((import.meta as any).env?.VITE_AUTO_APPROVE_ALL),
  AUTO_APPROVE_ORDERS: toBool((import.meta as any).env?.VITE_AUTO_APPROVE_ORDERS),
  AUTO_APPROVE_LISTINGS: toBool((import.meta as any).env?.VITE_AUTO_APPROVE_LISTINGS),
  AUTO_APPROVE_SIGNUPS: toBool((import.meta as any).env?.VITE_AUTO_APPROVE_SIGNUPS),
  AUTO_APPROVE_COURIERS: toBool((import.meta as any).env?.VITE_AUTO_APPROVE_COURIERS),
  AUTO_APPROVE_REVIEWS: toBool((import.meta as any).env?.VITE_AUTO_APPROVE_REVIEWS),
  AUTO_BYPASS_EMAIL_VERIFICATION: toBool((import.meta as any).env?.VITE_AUTO_BYPASS_EMAIL_VERIFICATION),
};

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  refreshFlags: () => Promise<void>;
  shouldAutoApprove: (entity?: 'ORDERS' | 'LISTINGS' | 'SIGNUPS' | 'COURIERS' | 'REVIEWS') => boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

async function fetchRuntimeFlags(): Promise<Partial<FeatureFlags>> {
  try {
    const url = `/runtime-flags.json?ts=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Partial<FeatureFlags>;
    return json;
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
      // Never auto-approve in production environment
      if ((import.meta as any).env?.MODE === 'production') {
        return false;
      }
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
