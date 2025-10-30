import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { validateOrder } from '@/utils/realtimeValidation';

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
      console.error('Error fetching orders:', error);
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
    // Wrap in try-catch to handle any synchronous errors
    try {
      fetchOrders().catch((error) => {
        console.error('Unhandled error in fetchOrders:', error);
      });
    } catch (error) {
      console.error('Error initializing order fetch:', error);
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
                  console.error('Received invalid order data, refetching...');
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
            } catch (error) {
              console.error('Error processing realtime order update:', error);
              fetchOrders();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime orders subscription active');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Realtime orders subscription error, retrying...');
            setTimeout(() => fetchOrders(), 5000);
          } else if (status === 'TIMED_OUT') {
            console.error('Realtime orders subscription timed out');
            fetchOrders();
          }
        });

      setChannel(newChannel);
    }, 500);

    return () => {
      clearTimeout(connectionTimeout);
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  }, [statusFilter?.join(',')]); // Only re-run if filter changes

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    channel
  };
};
