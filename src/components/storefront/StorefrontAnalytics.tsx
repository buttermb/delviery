/**
 * Storefront Analytics Tracker
 * Lightweight component and hook for tracking storefront events
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

type AnalyticsEventType = 'page_view' | 'product_view' | 'add_to_cart' | 'remove_from_cart' | 'checkout_start';

interface AnalyticsEvent {
  event_type: AnalyticsEventType;
  tenant_id: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface StorefrontAnalyticsProps {
  tenantSlug: string;
  pageType: string;
  pageId?: string;
}

const EVENT_QUEUE_FLUSH_INTERVAL = 5000;
const EVENT_QUEUE_MAX_SIZE = 10;

let eventQueue: AnalyticsEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let resolvedTenantId: string | null = null;

async function resolveTenantId(slug: string): Promise<string | null> {
  if (resolvedTenantId) return resolvedTenantId;

  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (data) {
    resolvedTenantId = data.id;
  }
  return resolvedTenantId;
}

async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  try {
    const { error } = await (supabase as any)
      .from('storefront_analytics')
      .insert(batch) as { error: { message: string } | null };

    if (error) {
      logger.warn('Failed to flush analytics events', { error: error.message, count: batch.length });
    }
  } catch (err) {
    logger.warn('Analytics flush failed', err);
  }
}

function queueEvent(event: AnalyticsEvent): void {
  eventQueue = [...eventQueue, event];

  if (eventQueue.length >= EVENT_QUEUE_MAX_SIZE) {
    flushEvents();
    return;
  }

  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushEvents, EVENT_QUEUE_FLUSH_INTERVAL);
}

export function useStorefrontAnalytics(tenantSlug: string) {
  const tenantSlugRef = useRef(tenantSlug);
  tenantSlugRef.current = tenantSlug;

  const trackEvent = useCallback(
    async (
      eventType: AnalyticsEventType,
      metadata?: Record<string, unknown>
    ): Promise<void> => {
      const tenantId = await resolveTenantId(tenantSlugRef.current);
      if (!tenantId) return;

      queueEvent({
        event_type: eventType,
        tenant_id: tenantId,
        metadata,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      flushEvents();
    };
  }, []);

  return { trackEvent };
}

export default function StorefrontAnalytics({
  tenantSlug,
  pageType,
  pageId,
}: StorefrontAnalyticsProps) {
  const { trackEvent } = useStorefrontAnalytics(tenantSlug);

  useEffect(() => {
    trackEvent('page_view', { page_type: pageType, page_id: pageId });
  }, [trackEvent, pageType, pageId]);

  return null;
}
