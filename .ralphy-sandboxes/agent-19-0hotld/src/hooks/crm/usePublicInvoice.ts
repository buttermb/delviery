import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CRMInvoice, LineItem } from "@/types/crm";
import { queryKeys } from "@/lib/queryKeys";

interface PublicInvoiceResponse {
    id: string;
    account_id: string;
    client_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    line_items: LineItem[];
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    status: string;
    notes: string | null;
    public_token: string;
    amount_paid: number | null;
    public_view_count: number;
    last_viewed_at: string | null;
    created_at: string;
    updated_at: string;
    client: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
    } | null;
}

export function usePublicInvoice(token: string | undefined) {
    return useQuery({
        queryKey: queryKeys.crm.invoices.byToken(token ?? ''),
        queryFn: async () => {
            if (!token) return null;

            // Use RPC function for view tracking and bypassing RLS
            const { data, error } = await supabase
                .rpc("get_public_invoice", { p_token: token });

            if (error) throw error;
            if (!data) return null;

            const invoice = data as unknown as PublicInvoiceResponse;

            return {
                ...invoice,
                line_items: Array.isArray(invoice.line_items) ? invoice.line_items : [],
                issue_date: invoice.invoice_date,
                tax: invoice.tax_amount,
            } as CRMInvoice & { public_view_count?: number; last_viewed_at?: string };
        },
        enabled: !!token,
    });
}
