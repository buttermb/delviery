/**
 * Customer Hub Counts Hook
 * Provides counts for the Customer Hub Quick Links section
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export interface CustomerHubCounts {
    totalCustomers: number;
    pendingVerification: number;
    wholesaleClients: number;
    activeGroups: number;
    recentMessages: number;
}

export function useCustomerHubCounts() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: ['customers', 'hub-counts', tenantId],
        queryFn: async (): Promise<CustomerHubCounts> => {
            if (!tenantId) {
                return {
                    totalCustomers: 0,
                    pendingVerification: 0,
                    wholesaleClients: 0,
                    activeGroups: 0,
                    recentMessages: 0,
                };
            }

            // Fetch counts in parallel
            const [
                customersResult,
                wholesaleClientsResult,
                pendingLicenseResult,
            ] = await Promise.all([
                // Total customers
                supabase
                    .from('customers')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .is('deleted_at', null),

                // Total wholesale clients
                supabase
                    .from('wholesale_clients')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .is('deleted_at', null),

                // Wholesale clients with pending/expiring license verification
                // License status 'pending' or license expiring within 30 days
                supabase
                    .from('wholesale_clients')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .is('deleted_at', null)
                    .or(`license_status.eq.pending,license_status.eq.expired,license_expiration_date.lte.${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`),
            ]);

            return {
                totalCustomers: customersResult.count ?? 0,
                pendingVerification: pendingLicenseResult.count ?? 0,
                wholesaleClients: wholesaleClientsResult.count ?? 0,
                activeGroups: 0, // Placeholder - customer groups feature not yet implemented
                recentMessages: 0, // Placeholder - communication history feature not yet implemented
            };
        },
        enabled: !!tenantId,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refresh every minute
    });

    return {
        counts: data ?? {
            totalCustomers: 0,
            pendingVerification: 0,
            wholesaleClients: 0,
            activeGroups: 0,
            recentMessages: 0,
        },
        isLoading,
        error,
    };
}
