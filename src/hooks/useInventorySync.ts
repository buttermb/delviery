import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

interface UseInventorySyncProps {
    tenantId?: string;
    enabled?: boolean;
}

export function useInventorySync({ tenantId, enabled = true }: UseInventorySyncProps) {
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!enabled || !tenantId) return;

        const channel = supabase
            .channel('inventory-sync')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'products',
                    filter: `tenant_id=eq.${tenantId}`,
                },
                (payload) => {
                    logger.info('Inventory update received:', payload);
                    setLastSynced(new Date());

                    // Optional: Show toast for significant updates or low stock
                    const newStock = payload.new.stock_quantity;
                    const oldStock = payload.old.stock_quantity;

                    if (newStock === 0 && oldStock > 0) {
                        toast({
                            title: "Product Out of Stock",
                            description: `${payload.new.name} is now out of stock.`,
                            variant: "destructive"
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, enabled, toast]);

    return {
        lastSynced,
        isConnected: !!tenantId && enabled
    };
}
