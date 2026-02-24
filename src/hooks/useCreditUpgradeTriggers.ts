/**
 * useCreditUpgradeTriggers Hook
 * 
 * Manages progressive upgrade triggers based on credit balance and usage patterns.
 * Provides non-annoying upgrade prompts at strategic moments.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCredits } from './useCredits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import {
  CREDIT_WARNING_THRESHOLDS,
  BEHAVIORAL_TRIGGERS,
  trackCreditEvent,
} from '@/lib/credits';

// ============================================================================
// Types
// ============================================================================

export type TriggerType = 
  | 'yellow_badge'
  | 'warning_modal'
  | 'banner_warning'
  | 'blocked'
  | 'menus_milestone'
  | 'orders_milestone'
  | 'days_milestone';

export interface UpgradeTrigger {
  type: TriggerType;
  shouldShow: boolean;
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  dismissKey: string;
}

export interface UseCreditUpgradeTriggersReturn {
  // Current trigger states
  showYellowBadge: boolean;
  showWarningModal: boolean;
  showBannerWarning: boolean;
  isBlocked: boolean;
  
  // Behavioral triggers
  showMenusMilestone: boolean;
  showOrdersMilestone: boolean;
  showDaysMilestone: boolean;
  
  // Actions
  dismissTrigger: (type: TriggerType) => void;
  resetAllTriggers: () => void;
  
  // Active triggers list
  activeTriggers: UpgradeTrigger[];
  
  // Helper
  hasAnyTrigger: boolean;
  mostUrgentTrigger: UpgradeTrigger | null;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_PREFIX = 'credit_trigger_';
const getStorageKey = (tenantId: string, type: string) => 
  `${STORAGE_PREFIX}${tenantId}_${type}`;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCreditUpgradeTriggers(): UseCreditUpgradeTriggersReturn {
  const { tenant } = useTenantAdminAuth();
  const { balance, isFreeTier, isLoading } = useCredits();
  
  const tenantId = tenant?.id;
  
  // Dismissed triggers state (session-based for modals, persistent for milestones)
  const [dismissedTriggers, setDismissedTriggers] = useState<Set<string>>(new Set());
  
  // Load dismissed triggers from storage
  useEffect(() => {
    if (!tenantId) return;
    
    try {
      const dismissed = new Set<string>();
      
      // Check session storage for session-based dismissals
      const sessionDismissed = sessionStorage.getItem(getStorageKey(tenantId, 'session'));
      if (sessionDismissed) {
        JSON.parse(sessionDismissed).forEach((t: string) => dismissed.add(t));
      }
      
      // Check local storage for persistent dismissals
      const persistentDismissed = localStorage.getItem(getStorageKey(tenantId, 'persistent'));
      if (persistentDismissed) {
        JSON.parse(persistentDismissed).forEach((t: string) => dismissed.add(t));
      }
      
      setDismissedTriggers(dismissed);
    } catch (error) {
      logger.warn('Failed to load dismissed triggers', { error });
    }
  }, [tenantId]);
  
  // Calculate credit-based triggers
  const creditTriggers = useMemo(() => {
    if (!isFreeTier || isLoading) {
      return {
        showYellowBadge: false,
        showWarningModal: false,
        showBannerWarning: false,
        isBlocked: false,
      };
    }
    
    return {
      showYellowBadge: balance <= CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE,
      showWarningModal: balance <= CREDIT_WARNING_THRESHOLDS.WARNING_MODAL && 
                        !dismissedTriggers.has('warning_modal'),
      showBannerWarning: balance <= CREDIT_WARNING_THRESHOLDS.BANNER_WARNING && 
                         !dismissedTriggers.has('banner_warning'),
      isBlocked: balance <= CREDIT_WARNING_THRESHOLDS.BLOCKED,
    };
  }, [balance, isFreeTier, isLoading, dismissedTriggers]);
  
  // Calculate behavioral triggers (would need usage data from tenant)
  const behavioralTriggers = useMemo(() => {
    if (!isFreeTier || !tenant) {
      return {
        showMenusMilestone: false,
        showOrdersMilestone: false,
        showDaysMilestone: false,
      };
    }
    
    const usage = (tenant?.usage ?? {}) as Record<string, number>;
    const createdAt = tenant?.created_at ? new Date(tenant.created_at) : null;
    const daysOnPlatform = createdAt 
      ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return {
      showMenusMilestone: (usage.menus || 0) >= BEHAVIORAL_TRIGGERS.MENUS_CREATED && 
                          !dismissedTriggers.has('menus_milestone'),
      showOrdersMilestone: (usage.orders || 0) >= BEHAVIORAL_TRIGGERS.ORDERS_RECEIVED && 
                           !dismissedTriggers.has('orders_milestone'),
      showDaysMilestone: daysOnPlatform >= BEHAVIORAL_TRIGGERS.DAYS_ON_FREE_TIER && 
                         !dismissedTriggers.has('days_milestone'),
    };
  }, [isFreeTier, tenant, dismissedTriggers]);
  
  // Build active triggers list
  const activeTriggers = useMemo<UpgradeTrigger[]>(() => {
    const triggers: UpgradeTrigger[] = [];
    
    if (creditTriggers.isBlocked) {
      triggers.push({
        type: 'blocked',
        shouldShow: true,
        message: "You're out of credits. Upgrade for unlimited access.",
        urgency: 'critical',
        dismissKey: 'blocked',
      });
    }
    
    if (creditTriggers.showBannerWarning) {
      triggers.push({
        type: 'banner_warning',
        shouldShow: true,
        message: `Only ${balance} credits left. Upgrade to never run out.`,
        urgency: 'high',
        dismissKey: 'banner_warning',
      });
    }
    
    if (creditTriggers.showWarningModal) {
      triggers.push({
        type: 'warning_modal',
        shouldShow: true,
        message: `Running low on credits (${balance} remaining). Consider upgrading.`,
        urgency: 'medium',
        dismissKey: 'warning_modal',
      });
    }
    
    if (creditTriggers.showYellowBadge) {
      triggers.push({
        type: 'yellow_badge',
        shouldShow: true,
        message: 'Credit balance is getting low.',
        urgency: 'low',
        dismissKey: 'yellow_badge',
      });
    }
    
    if (behavioralTriggers.showMenusMilestone) {
      triggers.push({
        type: 'menus_milestone',
        shouldShow: true,
        message: "You've created 3+ menus! Upgrade for unlimited menus.",
        urgency: 'low',
        dismissKey: 'menus_milestone',
      });
    }
    
    if (behavioralTriggers.showOrdersMilestone) {
      triggers.push({
        type: 'orders_milestone',
        shouldShow: true,
        message: "You're growing! 10+ orders received. Ready for unlimited?",
        urgency: 'low',
        dismissKey: 'orders_milestone',
      });
    }
    
    if (behavioralTriggers.showDaysMilestone) {
      triggers.push({
        type: 'days_milestone',
        shouldShow: true,
        message: "You've been with us for 2 weeks. How's it going?",
        urgency: 'low',
        dismissKey: 'days_milestone',
      });
    }
    
    return triggers;
  }, [creditTriggers, behavioralTriggers, balance]);
  
  // Dismiss a trigger
  const dismissTrigger = useCallback((type: TriggerType) => {
    if (!tenantId) return;
    
    setDismissedTriggers(prev => {
      const next = new Set(prev);
      next.add(type);
      return next;
    });
    
    // Persist dismissal
    try {
      // Session-based triggers (warning_modal, banner_warning)
      if (['warning_modal', 'banner_warning'].includes(type)) {
        const key = getStorageKey(tenantId, 'session');
        const current = JSON.parse(sessionStorage.getItem(key) || '[]');
        sessionStorage.setItem(key, JSON.stringify([...new Set([...current, type])]));
      }
      
      // Persistent triggers (milestones)
      if (['menus_milestone', 'orders_milestone', 'days_milestone'].includes(type)) {
        const key = getStorageKey(tenantId, 'persistent');
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...new Set([...current, type])]));
      }
      
      // Track dismissal event
      trackCreditEvent(tenantId, `trigger_dismissed_${type}`, balance);
    } catch (error) {
      logger.warn('Failed to persist trigger dismissal', { error, type });
    }
  }, [tenantId, balance]);
  
  // Reset all triggers (for testing or when user upgrades)
  const resetAllTriggers = useCallback(() => {
    if (!tenantId) return;
    
    setDismissedTriggers(new Set());
    
    try {
      sessionStorage.removeItem(getStorageKey(tenantId, 'session'));
      localStorage.removeItem(getStorageKey(tenantId, 'persistent'));
    } catch (error) {
      logger.warn('Failed to reset triggers', { error });
    }
  }, [tenantId]);
  
  // Most urgent trigger
  const mostUrgentTrigger = useMemo(() => {
    if (activeTriggers.length === 0) return null;
    
    const urgencyOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    
    return activeTriggers.reduce((most, current) => 
      urgencyOrder[current.urgency] > urgencyOrder[most.urgency] ? current : most
    );
  }, [activeTriggers]);
  
  return {
    // Credit-based triggers
    ...creditTriggers,
    
    // Behavioral triggers
    ...behavioralTriggers,
    
    // Actions
    dismissTrigger,
    resetAllTriggers,
    
    // Active triggers
    activeTriggers,
    hasAnyTrigger: activeTriggers.length > 0,
    mostUrgentTrigger,
  };
}

// ============================================================================
// Export Types (already exported inline)
// ============================================================================







