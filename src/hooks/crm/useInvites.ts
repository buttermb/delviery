import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMInvite, InviteFormValues } from '@/types/crm';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

export const crmInviteKeys = {
    all: ['crm-invites'] as const,
    lists: () => [...crmInviteKeys.all, 'list'] as const,
    list: (filters: string) => [...crmInviteKeys.lists(), { filters }] as const,
};

export function useInvites(status?: 'pending' | 'accepted' | 'archived') {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmInviteKeys.list(status || 'all'),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            let query = supabase
                .from('crm_invites')
                .select('*, client:crm_clients(*)')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch invites', error, { component: 'useInvites', accountId, status });
                throw error;
            }
            return data as CRMInvite[];
        },
        enabled: !!accountId,
    });
}

export function useCreateInvite() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (values: InviteFormValues & { account_id?: string }) => {
            const finalAccountId = values.account_id || accountId;

            if (!finalAccountId) {
                throw new Error('Account ID is required to create an invite');
            }

            const { data, error } = await (supabase as any)
                .from('crm_invites')
                .insert({
                    account_id: finalAccountId,
                    name: values.name,
                    email: values.email || null,
                    phone: values.phone || null,
                    status: 'pending',
                    invite_token: crypto.randomUUID(),
                })
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to create invite', error, { component: 'useCreateInvite', accountId: finalAccountId });
                throw error;
            }
            return data as CRMInvite;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: crmInviteKeys.lists() });
            toast.success('Invite created successfully');
        },
        onError: (error: unknown) => {
            logger.error('Invite creation failed', error, { component: 'useCreateInvite' });
            toast.error(humanizeError(error, 'Failed to create invite'));
        },
    });
}

export function useArchiveInvite() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (inviteId: string) => {
            if (!accountId) {
                throw new Error('Account ID is required to archive an invite');
            }

            const { data, error } = await supabase
                .from('crm_invites')
                .update({ status: 'archived' })
                .eq('id', inviteId)
                .eq('account_id', accountId)
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to archive invite', error, { component: 'useArchiveInvite', inviteId, accountId });
                throw error;
            }
            return data as CRMInvite;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: crmInviteKeys.lists() });
            toast.success('Invite archived');
        },
        onError: (error: unknown) => {
            logger.error('Invite archive failed', error, { component: 'useArchiveInvite' });
            toast.error(humanizeError(error, 'Failed to archive invite'));
        },
    });
}
