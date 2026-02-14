// FILE: src/hooks/useFeatureTracking.ts
// Smart pattern detection - tracks which features users interact with most

import { useCallback, useEffect, useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface UserPattern {
  mostUsedFeatures: string[];
  typicalLoginTime: string | null;
  avgSessionLengthMinutes: number;
  primaryWorkflow: string | null;
  lastUpdated: string;
}

interface FeatureUsage {
  featureId: string;
  count: number;
  lastUsed: string;
}

const STORAGE_KEY = 'user_feature_patterns';
const MAX_TRACKED_FEATURES = 20;

export function useFeatureTracking() {
  const { tenant, admin } = useTenantAdminAuth();
  const [patterns, setPatterns] = useState<UserPattern | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [sessionStart] = useState<Date>(new Date());

  // Load patterns from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPatterns(parsed.patterns || null);
        setFeatureUsage(parsed.featureUsage || []);
      }
    } catch {
      logger.warn('Failed to load feature patterns from localStorage', { component: 'useFeatureTracking' });
    }
  }, []);

  // Save patterns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        patterns,
        featureUsage,
      }));
    } catch {
      // Silent fail for incognito mode
    }
  }, [patterns, featureUsage]);

  // Track feature usage
  const trackFeature = useCallback(async (featureId: string) => {
    const now = new Date().toISOString();

    setFeatureUsage(prev => {
      const existing = prev.find(f => f.featureId === featureId);
      let updated: FeatureUsage[];

      if (existing) {
        updated = prev.map(f =>
          f.featureId === featureId
            ? { ...f, count: f.count + 1, lastUsed: now }
            : f
        );
      } else {
        updated = [...prev, { featureId, count: 1, lastUsed: now }];
      }

      // Keep only top N features
      return updated
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_TRACKED_FEATURES);
    });

    // Also track to database if we have a user
    if (tenant?.id && admin?.userId) {
      try {
        await supabase.rpc('track_feature_usage', {
          p_user_id: admin.userId,
          p_tenant_id: tenant.id,
          p_feature_id: featureId,
        });
      } catch (error) {
        // Silent fail - don't block UI for tracking
        logger.debug('Failed to track feature to database', { featureId, error });
      }
    }
  }, [tenant?.id, admin?.userId]);

  // Get most used features
  const getMostUsedFeatures = useCallback((limit: number = 5): string[] => {
    return featureUsage
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(f => f.featureId);
  }, [featureUsage]);

  // Detect primary workflow based on feature patterns
  const detectPrimaryWorkflow = useCallback((): string => {
    const topFeatures = getMostUsedFeatures(3);

    // Workflow detection rules
    if (topFeatures.includes('pos-system') || topFeatures.includes('basic-orders')) {
      return 'retail'; // In-store focused
    }
    if (topFeatures.includes('disposable-menus') || topFeatures.includes('delivery-tracking')) {
      return 'delivery'; // Delivery focused
    }
    if (topFeatures.includes('wholesale-orders') || topFeatures.includes('b2b-clients')) {
      return 'wholesale'; // B2B focused
    }
    if (topFeatures.includes('analytics') || topFeatures.includes('financial-center')) {
      return 'management'; // Business management focused
    }
    if (topFeatures.includes('team-management') || topFeatures.includes('courier-management')) {
      return 'operations'; // Operations focused
    }

    return 'general';
  }, [getMostUsedFeatures]);

  // Calculate session length on unmount
  useEffect(() => {
    return () => {
      const sessionEnd = new Date();
      const sessionLengthMinutes = Math.round(
        (sessionEnd.getTime() - sessionStart.getTime()) / 60000
      );

      // Update average session length
      setPatterns(prev => {
        const currentAvg = prev?.avgSessionLengthMinutes || 0;
        const newAvg = currentAvg === 0
          ? sessionLengthMinutes
          : Math.round((currentAvg + sessionLengthMinutes) / 2);

        return {
          mostUsedFeatures: getMostUsedFeatures(10),
          typicalLoginTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit' }),
          avgSessionLengthMinutes: newAvg,
          primaryWorkflow: detectPrimaryWorkflow(),
          lastUpdated: new Date().toISOString(),
        };
      });
    };
  }, [sessionStart, getMostUsedFeatures, detectPrimaryWorkflow]);

  // Get personalized quick actions based on patterns
  const getPersonalizedQuickActions = useCallback((): string[] => {
    const workflow = detectPrimaryWorkflow();
    const topFeatures = getMostUsedFeatures(3);

    const workflowActions: Record<string, string[]> = {
      retail: ['pos-system', 'inventory-basic', 'customer-tabs'],
      delivery: ['disposable-menus', 'delivery-tracking', 'orders-pipeline'],
      wholesale: ['wholesale-orders', 'b2b-clients', 'crm-invoices'],
      management: ['analytics', 'financial-center', 'daily-reports'],
      operations: ['team-management', 'courier-management', 'shifts-management'],
      general: ['hotbox', 'basic-orders', 'products'],
    };

    // Combine workflow-based actions with user's actual top features
    const recommended = workflowActions[workflow] || workflowActions.general;
    const combined = [...new Set([...topFeatures, ...recommended])];

    return combined.slice(0, 5);
  }, [detectPrimaryWorkflow, getMostUsedFeatures]);

  // Check if user is a power user (uses many features)
  const isPowerUser = useCallback((): boolean => {
    return featureUsage.filter(f => f.count > 5).length >= 8;
  }, [featureUsage]);

  // Get greeting based on time of day and patterns
  const getPersonalizedGreeting = useCallback((userName: string): string => {
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';

    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else if (hour < 21) timeGreeting = 'Good evening';
    else timeGreeting = 'Working late';

    const workflow = detectPrimaryWorkflow();
    const workflowContext: Record<string, string> = {
      retail: 'Ready to serve customers?',
      delivery: 'Let\'s get those orders moving!',
      wholesale: 'Time to close some deals!',
      management: 'Let\'s check the numbers.',
      operations: 'Your team is counting on you!',
      general: 'What would you like to do today?',
    };

    return `${timeGreeting}, ${userName}! ${workflowContext[workflow] || ''}`;
  }, [detectPrimaryWorkflow]);

  return {
    patterns,
    featureUsage,
    trackFeature,
    getMostUsedFeatures,
    detectPrimaryWorkflow,
    getPersonalizedQuickActions,
    isPowerUser,
    getPersonalizedGreeting,
  };
}
