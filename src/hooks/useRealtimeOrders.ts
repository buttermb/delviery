import { logger } from '@/lib/logger';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { validateOrder } from '@/utils/realtimeValidation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useVerification } from '@/contexts/VerificationContext';

interface Order {
  id: string;
  status: string;
  tracking_code: string;
  total_amount: number;
  created_at: string;
  delivery_address: string;
  delivery_borough: string;
  eta_minutes?: number;
  eta_updated_at?: string;
  courier_id?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  [key: string]: any;
}

interface UseRealtimeOrdersOptions {
  statusFilter?: string[];
  autoRefetch?: boolean;
}

export const useRealtimeOrders = (options: UseRealtimeOrdersOptions = {}) => {
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const { isVerified, isVerifying } = useVerification();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const { statusFilter } = options;

  const fetchOrders = useCallback(async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          merchants (business_name, address, phone),
          addresses (street, city, state, zip_code),
          couriers (full_name, phone, email, vehicle_type, current_lat, current_lng),
          order_items (
            quantity,
            price,
            product_name,
            products (name, image_url)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setOrders(data || []);
      // Clear any previous errors on successful fetch
      setError(null);
    } catch (error) {
      logger.error('Error fetching orders:', error);
      // Set empty array on error to prevent stale data
      setOrders([]);
      // Store error for component to display
      setError(error instanceof Error ? error : new Error(String(error)));
      // Don't re-throw - let the hook handle the error gracefully
    } finally {
      setLoading(false);
    }
  }, [statusFilter?.join(',')]);

  useEffect(() => {
    // Guard 1: Don't fetch or subscribe if auth is still loading or tenant not available
    if (authLoading || !tenant?.id) {
      logger.debug('[useRealtimeOrders] Waiting for authentication...', { authLoading, hasTenant: !!tenant?.id });
      return;
    }

    // Guard 2: Don't subscribe until verification is complete
    if (!isVerified || isVerifying) {
      logger.debug('[useRealtimeOrders] Waiting for verification to complete...', { isVerified, isVerifying });
      return;
    }

    logger.debug('[useRealtimeOrders] Authentication verified, establishing realtime subscription');

    // Wrap in try-catch to handle any synchronous errors
    try {
      fetchOrders().catch((error) => {
        logger.error('Unhandled error in fetchOrders:', error);
      });
    } catch (error) {
      logger.error('Error initializing order fetch:', error);
    }

    let connectionTimeout: NodeJS.Timeout;
    
    // Wait for connection to be ready before subscribing
    connectionTimeout = setTimeout(() => {
      const newChannel = supabase
        .channel('orders-realtime', {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            try {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newOrder = payload.new as Order;
                
                // Validate before processing
                if (!validateOrder(newOrder)) {
                  logger.error('Received invalid order data, refetching...');
                  fetchOrders();
                  return;
                }
                
                // Refetch to get complete data with joins
                fetchOrders();
              } else if (payload.eventType === 'DELETE') {
                const oldOrder = payload.old as Order;
                if (oldOrder?.id) {
                  setOrders(prev => prev.filter(order => order.id !== oldOrder.id));
                }
              }
            } catch (error: unknown) {
              const errorObj = error instanceof Error ? error : new Error(String(error));
              logger.error('Error processing realtime order update', errorObj, { component: 'useRealtimeOrders' });
              fetchOrders();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug('Realtime orders subscription active', { component: 'useRealtimeOrders' });
          } else if (status === 'CHANNEL_ERROR') {
            logger.warn('Realtime orders subscription error, retrying...', { component: 'useRealtimeOrders', status });
            setTimeout(() => fetchOrders(), 5000);
          } else if (status === 'TIMED_OUT') {
            logger.warn('Realtime orders subscription timed out', { component: 'useRealtimeOrders', status });
            fetchOrders();
          } else if (status === 'CLOSED') {
            logger.debug('Realtime orders subscription closed', { component: 'useRealtimeOrders' });
          }
        });

      setChannel(newChannel);
    }, 500);

    return () => {
      logger.debug('Cleaning up realtime subscription', { component: 'useRealtimeOrders' });
      clearTimeout(connectionTimeout);
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  }, [authLoading, tenant?.id, isVerified, isVerifying, statusFilter?.join(',')]); // Re-run if auth state or filter changes

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    channel
  };
};
