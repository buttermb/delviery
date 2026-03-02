import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface PendingOrder {
    id: string;
    customer_id: string;
    items: Record<string, unknown>[];
    total_amount: number;
    status: string;
    created_at: string;
    customer?: {
        first_name: string;
        last_name: string;
        email: string;
    };
}

export function usePendingOrders(tenantId?: string) {
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId) return;

        loadPendingOrders();

        const channel = supabase
            .channel(`pending-orders-${tenantId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'disposable_menu_orders',
                    filter: `tenant_id=eq.${tenantId}`,
                },
                (payload) => {
                    logger.info('Pending order update:', payload);

                    if (payload.eventType === 'INSERT') {
                        // New order received
                        if (payload.new.status === 'ready_for_pickup') {
                            // Play notification sound
                            const audio = new Audio('/sounds/notification.mp3');
                            audio.play().catch(e => logger.warn('Error playing sound:', { error: e }));

                            toast.success('A new order is ready for pickup.');
                            loadPendingOrders();
                        }
                    } else {
                        // Update or delete
                        loadPendingOrders();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPendingOrders is defined below and depends on tenantId which is already in deps
    }, [tenantId]);

    const loadPendingOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('disposable_menu_orders')
                .select(`
          *,
          customer:customers(first_name, last_name, email)
        `)
                .eq('tenant_id', tenantId)
                .eq('status', 'ready_for_pickup')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setOrders((data ?? []) as unknown as PendingOrder[]);
        } catch (error) {
            logger.error('Error loading pending orders', error);
        } finally {
            setLoading(false);
        }
    };

    return { orders, loading, refresh: loadPendingOrders };
}
