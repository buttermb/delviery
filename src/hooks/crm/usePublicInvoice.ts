import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CRMInvoice, LineItem } from "@/types/crm";

export function usePublicInvoice(token: string | undefined) {
    return useQuery({
        queryKey: ["public-invoice", token],
        queryFn: async () => {
            if (!token) return null;

            const { data, error } = await supabase
                .from("crm_invoices")
                .select("*, client:crm_clients(*)")
                .eq("public_token", token)
                .maybeSingle();

            if (error) throw error;
            return {
                ...data,
                line_items: Array.isArray(data.line_items) ? (data.line_items as unknown as LineItem[]) : [],
                issue_date: data.invoice_date,
                tax: data.tax_amount,
            } as CRMInvoice;
        },
        enabled: !!token,
    });
}
