import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

export interface PendingOrder {
    id: string;
    customer_id: string;
    items: any[];
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
    const { toast } = useToast();

    useEffect(() => {
        if (!tenantId) return;

        loadPendingOrders();

        const channel = supabase
            .channel('pending-orders')
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

                            toast({
                                title: "New Pickup Order",
                                description: "A new order is ready for pickup.",
                            });
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

            setOrders((data || []) as any);
        } catch (error) {
            logger.error('Error loading pending orders', error);
        } finally {
            setLoading(false);
        }
    };

    return { orders, loading, refresh: loadPendingOrders };
}
