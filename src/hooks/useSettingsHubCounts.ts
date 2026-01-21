/**
 * Settings Hub Counts Hook
 * Provides completion/status indicators for the Settings Hub Quick Links section
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export interface SettingsHubCounts {
    teamMembers: number;
    pendingInvitations: number;
    integrationsConfigured: number;
    totalIntegrations: number;
    profileComplete: boolean;
    storeConfigured: boolean;
    notificationsEnabled: boolean;
    billingConfigured: boolean;
}

export function useSettingsHubCounts() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: ['settings', 'hub-counts', tenantId],
        queryFn: async (): Promise<SettingsHubCounts> => {
            if (!tenantId) {
                return {
                    teamMembers: 0,
                    pendingInvitations: 0,
                    integrationsConfigured: 0,
                    totalIntegrations: 5,
                    profileComplete: false,
                    storeConfigured: false,
                    notificationsEnabled: false,
                    billingConfigured: false,
                };
            }

            // Fetch counts in parallel
            const [
                teamMembersResult,
                storeResult,
            ] = await Promise.all([
                // Total team members
                supabase
                    .from('tenant_users')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active'),

                // Store configuration
                supabase
                    .from('marketplace_stores')
                    .select('id, store_name, logo_url, is_active')
                    .eq('tenant_id', tenantId)
                    .maybeSingle(),
            ]);

            // Check profile completeness (company name and email set)
            const profileComplete = !!(tenant?.company_name);

            // Check store configuration
            const storeConfigured = !!(storeResult.data?.store_name && storeResult.data?.is_active);

            // Check payment method added
            const billingConfigured = !!(tenant?.payment_method_added);

            // Calculate integrations configured (Stripe connect, etc.)
            const integrationsConfigured = billingConfigured ? 1 : 0;

            return {
                teamMembers: (teamMembersResult.count ?? 0) + 1, // +1 for owner
                pendingInvitations: 0, // Invitations are fetched via edge function
                integrationsConfigured,
                totalIntegrations: 5,
                profileComplete,
                storeConfigured,
                notificationsEnabled: true, // Assume notifications are enabled by default
                billingConfigured,
            };
        },
        enabled: !!tenantId,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refresh every minute
    });

    return {
        counts: data ?? {
            teamMembers: 0,
            pendingInvitations: 0,
            integrationsConfigured: 0,
            totalIntegrations: 5,
            profileComplete: false,
            storeConfigured: false,
            notificationsEnabled: false,
            billingConfigured: false,
        },
        isLoading,
        error,
    };
}
