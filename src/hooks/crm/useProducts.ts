import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';

export interface Product {
    id: string;
    name: string;
    price: number;
    sku?: string;
    description?: string;
}

export const useProducts = () => {
    const accountId = useAccountIdSafe();
    
    return useQuery({
        queryKey: ["crm-products", accountId],
        queryFn: async (): Promise<Product[]> => {
            if (!accountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from("products").select("id, name, price, sku, description").eq("account_id", accountId).eq("status", "active").order("name");
            if (error) throw error;
            return (data || []) as Product[];
        },
        enabled: !!accountId,
    });
};
