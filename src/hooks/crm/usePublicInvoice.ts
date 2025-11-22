import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CRMInvoice } from "@/types/crm";

export function usePublicInvoice(token: string | undefined) {
    return useQuery({
        queryKey: ["public-invoice", token],
        queryFn: async () => {
            if (!token) return null;

            const { data, error } = await supabase
                .from("crm_invoices")
                .select("*, client:crm_clients(*)")
                .eq("public_token", token)
                .single();

            if (error) throw error;
            return data as CRMInvoice;
        },
        enabled: !!token,
    });
}
