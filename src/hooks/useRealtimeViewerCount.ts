import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeViewerCount(tenantId: string | undefined): number {
  const [viewerCount, setViewerCount] = useState(0);
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const flush = () => {
      if (pendingRef.current > 0) {
        setViewerCount((prev) => prev + pendingRef.current);
        pendingRef.current = 0;
      }
      timerRef.current = null;
    };

    const channel = supabase
      .channel(`realtime-viewers-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'menu_access_logs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          pendingRef.current += 1;
          if (!timerRef.current) {
            timerRef.current = setTimeout(flush, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return viewerCount;
}
