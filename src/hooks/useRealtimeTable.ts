import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

type TableName = string;

interface RealtimeTableOptions<T> {
  /** Table name to subscribe to */
  table: TableName;
  /** Schema (default: 'public') */
  schema?: string;
  /** Filter by specific column value */
  filter?: { column: string; value: string };
  /** Show toast notifications for updates */
  showNotifications?: boolean;
  /** Custom notification message formatter */
  formatNotification?: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: T) => string;
  /** Callback for INSERT events */
  onInsert?: (record: T) => void;
  /** Callback for UPDATE events */
  onUpdate?: (record: T, oldRecord: T) => void;
  /** Callback for DELETE events */
  onDelete?: (record: T) => void;
  /** Generic callback for any change */
  onChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: T, oldRecord?: T) => void;
}

/**
 * Hook for real-time table updates via Supabase Realtime
 * 
 * @example
 * ```tsx
 * useRealtimeTable({
 *   table: 'orders',
 *   showNotifications: true,
 *   onUpdate: (order) => {
 *     setOrders(prev => prev.map(o => o.id === order.id ? order : o));
 *   },
 *   onInsert: (order) => {
 *     setOrders(prev => [order, ...prev]);
 *   },
 * });
 * ```
 */
export function useRealtimeTable<T extends { id: string }>(
  options: RealtimeTableOptions<T>
) {
  const {
    table,
    schema = 'public',
    filter,
    showNotifications = false,
    formatNotification,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<T>) => {
      const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
      const newRecord = payload.new as T;
      const oldRecord = payload.old as T;

      // Call specific handlers
      switch (eventType) {
        case 'INSERT':
          onInsert?.(newRecord);
          break;
        case 'UPDATE':
          onUpdate?.(newRecord, oldRecord);
          break;
        case 'DELETE':
          onDelete?.(oldRecord);
          break;
      }

      // Call generic handler
      onChange?.(eventType, eventType === 'DELETE' ? oldRecord : newRecord, oldRecord);

      // Show notification
      if (showNotifications) {
        const message = formatNotification
          ? formatNotification(eventType, eventType === 'DELETE' ? oldRecord : newRecord)
          : getDefaultNotification(eventType, table);

        toast({
          title: message,
          duration: 3000,
        });
      }
    },
    [table, showNotifications, formatNotification, onInsert, onUpdate, onDelete, onChange]
  );

  useEffect(() => {
    // Build channel name
    const channelName = filter
      ? `${table}_${filter.column}_${filter.value}`
      : `${table}_all`;

    // Build filter string for Supabase
    const filterConfig = filter
      ? `${filter.column}=eq.${filter.value}`
      : undefined;

    // Subscribe to changes
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema,
          table,
          filter: filterConfig,
        },
        handlePayload as any
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, schema, filter?.column, filter?.value, handlePayload]);

  // Return channel for manual management if needed
  return channelRef.current;
}

function getDefaultNotification(
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string
): string {
  const tableLabel = table.replace(/_/g, ' ').replace(/s$/, '');
  
  switch (event) {
    case 'INSERT':
      return `New ${tableLabel} added`;
    case 'UPDATE':
      return `${tableLabel} updated`;
    case 'DELETE':
      return `${tableLabel} removed`;
  }
}

/**
 * Hook for polling data as a fallback when realtime isn't available
 */
export function usePolledData<T>(
  fetcher: () => Promise<T>,
  options: {
    interval?: number;
    enabled?: boolean;
    onUpdate?: (data: T, prevData: T | null) => void;
  } = {}
) {
  const { interval = 5000, enabled = true, onUpdate } = options;
  const dataRef = useRef<T | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      try {
        const newData = await fetcherRef.current();
        
        // Check if data changed
        if (JSON.stringify(newData) !== JSON.stringify(dataRef.current)) {
          onUpdate?.(newData, dataRef.current);
          dataRef.current = newData;
        }
      } catch (error) {
        logger.error('[Polling] Error', error);
      }
    };

    // Initial fetch
    poll();

    // Start polling
    const pollInterval = setInterval(poll, interval);

    return () => clearInterval(pollInterval);
  }, [enabled, interval, onUpdate]);
}

export default useRealtimeTable;
