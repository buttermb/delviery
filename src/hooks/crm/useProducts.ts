import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountIdSafe } from './useAccountId';
import { queryKeys } from "@/lib/queryKeys";

export interface Product {
    id: string;
    name: string;
    price: number;
    sku?: string;
    description?: string;
    stockQuantity: number;
    isOutOfStock: boolean;
    isLowStock: boolean;
}

export const useProducts = () => {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: queryKeys.crm.products.lists(),
        queryFn: async (): Promise<Product[]> => {
            if (!accountId) throw new Error('Account ID required');

            // Break chain to avoid deep type instantiation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase deep type instantiation workaround
            const query = supabase.from("products");
            const result = await query
              .select("id, name, price, sku, description, stock_quantity, available_quantity, low_stock_alert")
              .eq("account_id", accountId)
              .eq("status", "active")
              .order("name")
              .limit(500);

            if (result.error) throw result.error;

            interface ProductRow { id: string; name: string; price: number; sku?: string; description?: string; stock_quantity?: number; available_quantity?: number; low_stock_alert?: number }
            return ((result.data as ProductRow[]) ?? []).map((item) => {
                const available = item.available_quantity ?? item.stock_quantity ?? 0;
                const threshold = item.low_stock_alert ?? 10;
                return {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    sku: item.sku ?? undefined,
                    description: item.description ?? undefined,
                    stockQuantity: available,
                    isOutOfStock: available <= 0,
                    isLowStock: available > 0 && available <= threshold,
                };
            });
        },
        enabled: !!accountId,
    });
};
