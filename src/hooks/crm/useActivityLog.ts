import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMActivityLog } from '@/types/crm';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

export const crmActivityKeys = {
    all: ['crm-activity'] as const,
    lists: () => [...crmActivityKeys.all, 'list'] as const,
    byClient: (clientId: string) => [...crmActivityKeys.all, 'client', clientId] as const,
    recent: (limit: number) => [...crmActivityKeys.all, 'recent', limit] as const,
};

export function useClientActivity(clientId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmActivityKeys.byClient(clientId ?? ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];

            const { data, error } = await supabase
                .from('crm_activity_log')
                .select('id, account_id, client_id, contact_id, activity_type, description, reference_id, reference_type, metadata, performed_by_user_id, performed_by_name, created_at')
                .eq('client_id', clientId)
                .eq('account_id', accountId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                logger.error('Failed to fetch client activity', error, { component: 'useClientActivity', clientId, accountId });
                throw error;
            }
            return data as CRMActivityLog[];
        },
        enabled: !!clientId && !!accountId,
    });
}

export function useRecentActivity(limit: number = 10) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmActivityKeys.recent(limit),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            const { data, error } = await supabase
                .from('crm_activity_log')
                .select('id, account_id, client_id, contact_id, activity_type, description, reference_id, reference_type, metadata, performed_by_user_id, performed_by_name, created_at, client:crm_clients(name)')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                logger.error('Failed to fetch recent activity', error, { component: 'useRecentActivity', accountId, limit });
                throw error;
            }
            return data as CRMActivityLog[];
        },
        enabled: !!accountId,
    });
}

export function useLogActivity() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (activity: Omit<CRMActivityLog, 'id' | 'created_at' | 'account_id' | 'performed_by_user_id' | 'performed_by_name'> & { account_id?: string }) => {
            const finalAccountId = activity.account_id || accountId;

            if (!finalAccountId) {
                throw new Error('Account ID is required to log activity');
            }

            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('crm_activity_log')
                .insert({
                    account_id: finalAccountId,
                    ...activity,
                    performed_by_user_id: user?.id,
                })
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to log activity', error, { component: 'useLogActivity', accountId: finalAccountId });
                throw error;
            }
            return data as CRMActivityLog;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: crmActivityKeys.byClient(data.client_id) });
            queryClient.invalidateQueries({ queryKey: crmActivityKeys.recent(10) });
        },
        onError: (error: unknown) => {
            logger.error('Activity logging failed', error, { component: 'useLogActivity' });
            toast.error('Failed to log activity', { description: humanizeError(error) });
        },
    });
}
