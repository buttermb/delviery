import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountIdSafe } from './useAccountId';

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
            
            // Break chain to avoid deep type instantiation
            const query = supabase.from("products");
            const selectQuery = query.select("id, name, price, sku, description") as any;
            const accountQuery = selectQuery.eq("account_id", accountId);
            const statusQuery = accountQuery.eq("status", "active");
            const result = await statusQuery.order("name");
            
            if (result.error) throw result.error;
            
            return ((result.data as any[]) || []).map((item: any) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                sku: item.sku ?? undefined,
                description: item.description ?? undefined,
            }));
        },
        enabled: !!accountId,
    });
};
