/**
 * Hook to track real-time connection status across all subscriptions
 * Provides a unified connection status for use with RealtimeIndicator component
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type RealtimeConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

interface UseRealtimeConnectionStatusOptions {
  enabled?: boolean;
}

/**
 * Hook to monitor real-time connection status
 * Tracks Supabase real-time channel status
 */
export function useRealtimeConnectionStatus(options: UseRealtimeConnectionStatusOptions = {}) {
  const { enabled = true } = options;
  const [status, setStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    // Monitor Supabase real-time connection
    const channel = supabase
      .channel('connection-status-monitor')
      .on('system', {}, (payload) => {
        logger.debug('Realtime system event', { payload, component: 'useRealtimeConnectionStatus' });
      })
      .subscribe((subscriptionStatus) => {
        logger.debug('Realtime connection status changed', { 
          subscriptionStatus, 
          component: 'useRealtimeConnectionStatus' 
        });

        switch (subscriptionStatus) {
          case 'SUBSCRIBED':
            setStatus('connected');
            setLastUpdate(new Date());
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            setStatus('error');
            break;
          case 'CLOSED':
            setStatus('disconnected');
            break;
          default:
            setStatus('connecting');
        }
      });

    // Also monitor network status
    const handleOnline = () => {
      logger.debug('Network online', { component: 'useRealtimeConnectionStatus' });
      if (status === 'disconnected' || status === 'error') {
        setStatus('connecting');
      }
    };

    const handleOffline = () => {
      logger.debug('Network offline', { component: 'useRealtimeConnectionStatus' });
      setStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, status]);

  return {
    status,
    isConnected: status === 'connected',
    lastUpdate,
  };
}

