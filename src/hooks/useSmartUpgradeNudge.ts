// @ts-nocheck
/**
 * useSmartUpgradeNudge Hook
 * 
 * Intelligent upgrade prompt system based on usage patterns.
 * Shows contextual upgrade nudges at optimal moments.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from './useCredits';
import {
  CREDIT_WARNING_THRESHOLDS,
  BEHAVIORAL_TRIGGERS,
  projectDepletion,
} from '@/lib/credits';

// ============================================================================
// Types
// ============================================================================

export type NudgeType =
  | 'credit_threshold'     // Balance below threshold
  | 'rapid_burn'           // Using credits very fast
  | 'order_milestone'      // Hit order count milestone
  | 'menu_milestone'       // Created multiple menus
  | 'time_on_free'         // Been on free tier X days
  | 'blocked_action'       // Tried to do something without credits
  | 'depletion_warning'    // Projected to run out soon
  | 'high_activity';       // Very active user

export type NudgeUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface UpgradeNudge {
  type: NudgeType;
  urgency: NudgeUrgency;
  title: string;
  message: string;
  cta: string;
  dismissable: boolean;
  showModal?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UseSmartUpgradeNudgeReturn {
  /** Current active nudge (if any) */
  activeNudge: UpgradeNudge | null;
  /** All pending nudges sorted by priority */
  pendingNudges: UpgradeNudge[];
  /** Dismiss the current nudge */
  dismissNudge: () => void;
  /** Dismiss a specific nudge type */
  dismissNudgeType: (type: NudgeType) => void;
  /** Check if a nudge type has been dismissed */
  isNudgeDismissed: (type: NudgeType) => boolean;
  /** Reset all dismissed nudges (for new session) */
  resetDismissedNudges: () => void;
  /** Show a specific nudge type manually */
  showNudge: (type: NudgeType) => void;
  /** Whether any nudge is currently showing */
  isShowing: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_DISMISSED = 'credit_nudges_dismissed';
const STORAGE_KEY_SHOWN_SESSION = 'credit_nudges_shown_session';

// ============================================================================
// Nudge Configurations
// ============================================================================

const NUDGE_CONFIGS: Record<NudgeType, Omit<UpgradeNudge, 'type' | 'metadata'>> = {
  credit_threshold: {
    urgency: 'high',
    title: 'Running Low on Credits',
    message: 'Your credit balance is getting low. Upgrade for unlimited access.',
    cta: 'View Plans',
    dismissable: true,
    showModal: true,
  },
  rapid_burn: {
    urgency: 'medium',
    title: "You're on Fire! 🔥",
    message: "You're using credits fast today. Consider upgrading for unlimited actions.",
    cta: 'Go Unlimited',
    dismissable: true,
    showModal: false,
  },
  order_milestone: {
    urgency: 'low',
    title: 'Business is Booming! 📈',
    message: "You've processed many orders. Upgrade to remove limits and grow further.",
    cta: 'Unlock Growth',
    dismissable: true,
    showModal: false,
  },
  menu_milestone: {
    urgency: 'low',
    title: 'Menu Master 🍽️',
    message: "You're creating lots of menus. Upgrade for unlimited menus and features.",
    cta: 'Upgrade Now',
    dismissable: true,
    showModal: false,
  },
  time_on_free: {
    urgency: 'low',
    title: "How's It Going?",
    message: "You've been exploring for a while. Ready to unlock the full experience?",
    cta: "See What You're Missing",
    dismissable: true,
    showModal: false,
  },
  blocked_action: {
    urgency: 'critical',
    title: "You've Run Out of Credits",
    message: 'Top up credits or upgrade to continue using all features.',
    cta: 'Get Credits',
    dismissable: false,
    showModal: true,
  },
  depletion_warning: {
    urgency: 'medium',
    title: 'Credits Running Out Soon',
    message: "At your current pace, you'll run out of credits in a few days.",
    cta: 'Plan Ahead',
    dismissable: true,
    showModal: true,
  },
  high_activity: {
    urgency: 'low',
    title: 'Power User Detected!',
    message: "You're getting great value. Upgrade to remove credit costs entirely.",
    cta: 'Upgrade',
    dismissable: true,
    showModal: false,
  },
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSmartUpgradeNudge(): UseSmartUpgradeNudgeReturn {
  const { tenant } = useTenantAdminAuth();
  const { balance, isFreeTier, isOutOfCredits } = useCredits();
  
  const [dismissedNudges, setDismissedNudges] = useState<Set<NudgeType>>(new Set());
  const [shownThisSession, setShownThisSession] = useState<Set<NudgeType>>(new Set());
  const [manualNudge, setManualNudge] = useState<NudgeType | null>(null);

  const tenantId = tenant?.id;

  // Load dismissed nudges from storage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_DISMISSED);
      if (stored) {
        setDismissedNudges(new Set(JSON.parse(stored)));
      }
      const shownSession = sessionStorage.getItem(STORAGE_KEY_SHOWN_SESSION);
      if (shownSession) {
        setShownThisSession(new Set(JSON.parse(shownSession)));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Fetch usage data for behavioral triggers
  const { data: usageData } = useQuery({
    queryKey: ['credit-usage-data', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get today's usage
      const { data: todayUsage } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('transaction_type', 'usage')
        .gte('created_at', today.toISOString());

      // Get action counts
      const { data: actionCounts } = await supabase
        .from('credit_transactions')
        .select('action_type')
        .eq('tenant_id', tenantId)
        .eq('transaction_type', 'usage')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Get tenant creation date
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('created_at')
        .eq('id', tenantId)
        .maybeSingle();

      const todayBurn = (todayUsage || []).reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
      );

      const orderCount = (actionCounts || []).filter(
        (a) => a.action_type === 'menu_order_received' || a.action_type === 'order_create_manual'
      ).length;

      const menuCount = (actionCounts || []).filter(
        (a) => a.action_type === 'menu_create'
      ).length;

      const daysOnFree = tenantData
        ? Math.floor((Date.now() - new Date(tenantData.created_at).getTime()) / (24 * 60 * 60 * 1000))
        : 0;

      return {
        todayBurn,
        orderCount,
        menuCount,
        daysOnFree,
        totalActionsToday: todayUsage?.length || 0,
      };
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Get projection data
  const { data: projection } = useQuery({
    queryKey: ['credit-projection-nudge', tenantId, balance],
    queryFn: async () => {
      if (!tenantId) return null;
      return projectDepletion(tenantId, balance);
    },
    enabled: !!tenantId && isFreeTier && balance > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate pending nudges based on conditions
  const pendingNudges = useMemo<UpgradeNudge[]>(() => {
    if (!isFreeTier) return [];

    const nudges: UpgradeNudge[] = [];

    // Manual nudge (highest priority)
    if (manualNudge) {
      const config = NUDGE_CONFIGS[manualNudge];
      nudges.push({ type: manualNudge, ...config });
    }

    // Blocked action (critical)
    if (isOutOfCredits) {
      nudges.push({ type: 'blocked_action', ...NUDGE_CONFIGS.blocked_action });
    }

    // Credit threshold
    if (balance <= CREDIT_WARNING_THRESHOLDS.WARNING_MODAL && balance > 0) {
      nudges.push({ 
        type: 'credit_threshold', 
        ...NUDGE_CONFIGS.credit_threshold,
        metadata: { balance },
      });
    }

    // Depletion warning
    if (projection?.daysRemaining !== null && projection.daysRemaining <= 5 && projection.daysRemaining > 0) {
      nudges.push({
        type: 'depletion_warning',
        ...NUDGE_CONFIGS.depletion_warning,
        metadata: { daysRemaining: projection.daysRemaining },
      });
    }

    // Behavioral triggers
    if (usageData) {
      // Rapid burn (>500 credits in one hour would be ~2000/day)
      if (usageData.todayBurn > 500 && usageData.totalActionsToday > 10) {
        nudges.push({
          type: 'rapid_burn',
          ...NUDGE_CONFIGS.rapid_burn,
          metadata: { todayBurn: usageData.todayBurn },
        });
      }

      // Order milestone
      if (usageData.orderCount >= BEHAVIORAL_TRIGGERS.ORDERS_RECEIVED) {
        nudges.push({
          type: 'order_milestone',
          ...NUDGE_CONFIGS.order_milestone,
          metadata: { orderCount: usageData.orderCount },
        });
      }

      // Menu milestone
      if (usageData.menuCount >= BEHAVIORAL_TRIGGERS.MENUS_CREATED) {
        nudges.push({
          type: 'menu_milestone',
          ...NUDGE_CONFIGS.menu_milestone,
          metadata: { menuCount: usageData.menuCount },
        });
      }

      // Time on free tier
      if (usageData.daysOnFree >= BEHAVIORAL_TRIGGERS.DAYS_ON_FREE_TIER) {
        nudges.push({
          type: 'time_on_free',
          ...NUDGE_CONFIGS.time_on_free,
          metadata: { daysOnFree: usageData.daysOnFree },
        });
      }

      // High activity
      if (usageData.totalActionsToday > 20) {
        nudges.push({
          type: 'high_activity',
          ...NUDGE_CONFIGS.high_activity,
          metadata: { actionsToday: usageData.totalActionsToday },
        });
      }
    }

    // Filter out dismissed and already shown this session
    return nudges.filter(
      (n) => !dismissedNudges.has(n.type) && 
             (n.type === manualNudge || !shownThisSession.has(n.type) || n.urgency === 'critical')
    );
  }, [
    isFreeTier,
    isOutOfCredits,
    balance,
    projection,
    usageData,
    manualNudge,
    dismissedNudges,
    shownThisSession,
  ]);

  // Sort by urgency
  const sortedNudges = useMemo(() => {
    const urgencyOrder: Record<NudgeUrgency, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return [...pendingNudges].sort(
      (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    );
  }, [pendingNudges]);

  // Active nudge is the highest priority one
  const activeNudge = sortedNudges[0] || null;

  // Mark active nudge as shown
  useEffect(() => {
    if (activeNudge && !shownThisSession.has(activeNudge.type)) {
      setShownThisSession((prev) => {
        const next = new Set(prev);
        next.add(activeNudge.type);
        try {
          sessionStorage.setItem(STORAGE_KEY_SHOWN_SESSION, JSON.stringify([...next]));
        } catch {
          // Ignore
        }
        return next;
      });
    }
  }, [activeNudge, shownThisSession]);

  // Dismiss handlers
  const dismissNudge = useCallback(() => {
    if (activeNudge?.dismissable) {
      setDismissedNudges((prev) => {
        const next = new Set(prev);
        next.add(activeNudge.type);
        try {
          sessionStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify([...next]));
        } catch {
          // Ignore
        }
        return next;
      });
    }
    setManualNudge(null);
  }, [activeNudge]);

  const dismissNudgeType = useCallback((type: NudgeType) => {
    setDismissedNudges((prev) => {
      const next = new Set(prev);
      next.add(type);
      try {
        sessionStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify([...next]));
      } catch {
        // Ignore
      }
      return next;
    });
    if (manualNudge === type) {
      setManualNudge(null);
    }
  }, [manualNudge]);

  const isNudgeDismissed = useCallback(
    (type: NudgeType) => dismissedNudges.has(type),
    [dismissedNudges]
  );

  const resetDismissedNudges = useCallback(() => {
    setDismissedNudges(new Set());
    setShownThisSession(new Set());
    try {
      sessionStorage.removeItem(STORAGE_KEY_DISMISSED);
      sessionStorage.removeItem(STORAGE_KEY_SHOWN_SESSION);
    } catch {
      // Ignore
    }
  }, []);

  const showNudge = useCallback((type: NudgeType) => {
    setManualNudge(type);
  }, []);

  return {
    activeNudge,
    pendingNudges: sortedNudges,
    dismissNudge,
    dismissNudgeType,
    isNudgeDismissed,
    resetDismissedNudges,
    showNudge,
    isShowing: !!activeNudge,
  };
}







