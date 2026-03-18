import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMMessage, MessageFormValues } from '@/types/crm';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

export const crmMessageKeys = {
    all: ['crm-messages'] as const,
    lists: () => [...crmMessageKeys.all, 'list'] as const,
    byClient: (clientId: string) => [...crmMessageKeys.all, 'client', clientId] as const,
};

export function useClientMessages(clientId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmMessageKeys.byClient(clientId ?? ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];

            const { data, error } = await supabase
                .from('crm_messages')
                .select('id, account_id, client_id, message_text, sender_type, sender_user_id, sender_name, created_at')
                .eq('client_id', clientId)
                .eq('account_id', accountId)
                .order('created_at', { ascending: true })
                .limit(200); // Chronological order for chat

            if (error) {
                logger.error('Failed to fetch client messages', error, { component: 'useClientMessages', clientId, accountId });
                throw error;
            }
            return data as CRMMessage[];
        },
        enabled: !!clientId && !!accountId,
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async ({ clientId, values }: { clientId: string; values: MessageFormValues & { account_id?: string } }) => {
            const finalAccountId = values.account_id || accountId;

            if (!finalAccountId) {
                throw new Error('Account ID is required to send a message');
            }

            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('crm_messages')
                .insert({
                    account_id: finalAccountId,
                    client_id: clientId,
                    message_text: values.message_text,
                    sender_type: 'admin',
                    sender_user_id: user?.id,
                })
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to send message', error, { component: 'useSendMessage', accountId: finalAccountId, clientId });
                throw error;
            }
            return data as CRMMessage;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: crmMessageKeys.byClient(variables.clientId) });
            toast.success('Message sent');
        },
        onError: (error: unknown) => {
            logger.error('Message send failed', error, { component: 'useSendMessage' });
            toast.error(humanizeError(error, 'Failed to send message'));
        },
    });
}
