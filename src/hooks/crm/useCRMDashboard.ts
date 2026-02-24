import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface ActivityLogEntry {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: Record<string, unknown> | null;
    created_at: string;
    client: { name: string } | null;
}

export interface CRMDashboardMetrics {
    totalClients: number;
    activeInvoicesCount: number;
    activeInvoicesValue: number;
    pendingPreOrdersCount: number;
    pendingPreOrdersValue: number;
    recentActivity: ActivityLogEntry[];
}

export const useCRMDashboard = () => {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: queryKeys.crm.dashboard.metrics(),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            // 1. Total Clients
            const { count: totalClients, error: clientsError } = await supabase
                .from("crm_clients")
                .select("*", { count: "exact", head: true })
                .eq("account_id", accountId)
                .eq("status", "active");

            if (clientsError) {
                logger.error('Failed to fetch clients count', clientsError, { component: 'useCRMDashboard', accountId });
                throw clientsError;
            }

            // 2. Active Invoices (Sent or Overdue)
            const { data: invoices, error: invoicesError } = await supabase
                .from("crm_invoices")
                .select("total")
                .eq("account_id", accountId)
                .in("status", ["sent", "overdue"]);

            if (invoicesError) {
                logger.error('Failed to fetch invoices', invoicesError, { component: 'useCRMDashboard', accountId });
                throw invoicesError;
            }

            const activeInvoicesCount = invoices?.length ?? 0;
            const activeInvoicesValue = invoices?.reduce((sum, inv) => sum + inv.total, 0) ?? 0;

            // 3. Pending Pre-Orders
            const { data: preOrders, error: preOrdersError } = await supabase
                .from("crm_pre_orders")
                .select("total")
                .eq("account_id", accountId)
                .eq("status", "pending");

            if (preOrdersError) {
                logger.error('Failed to fetch pre-orders', preOrdersError, { component: 'useCRMDashboard', accountId });
                throw preOrdersError;
            }

            const pendingPreOrdersCount = preOrders?.length ?? 0;
            const pendingPreOrdersValue = preOrders?.reduce((sum, po) => sum + po.total, 0) ?? 0;

            // 4. Recent Activity (select only needed columns)
            const { data: activity, error: activityError } = await supabase
                .from("crm_activity_log")
                .select("id, action, entity_type, entity_id, details, created_at, client:crm_clients(name)")
                .eq("account_id", accountId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (activityError) {
                logger.error('Failed to fetch activity', activityError, { component: 'useCRMDashboard', accountId });
                throw activityError;
            }

            return {
                totalClients: totalClients || 0,
                activeInvoicesCount,
                activeInvoicesValue,
                pendingPreOrdersCount,
                pendingPreOrdersValue,
                recentActivity: (activity ?? []) as unknown as ActivityLogEntry[],
            } as CRMDashboardMetrics;
        },
        enabled: !!accountId,
        staleTime: 30_000,
        gcTime: 300_000,
    });
};
