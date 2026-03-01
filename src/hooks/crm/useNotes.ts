import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMNote, NoteFormValues } from '@/types/crm';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

export const crmNoteKeys = {
    all: ['crm-notes'] as const,
    lists: () => [...crmNoteKeys.all, 'list'] as const,
    byClient: (clientId: string) => [...crmNoteKeys.all, 'client', clientId] as const,
};

export function useClientNotes(clientId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmNoteKeys.byClient(clientId ?? ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];

            const { data, error } = await supabase
                .from('crm_notes')
                .select('id, account_id, client_id, note_text, created_by_user_id, created_by_name, created_at')
                .eq('client_id', clientId)
                .eq('account_id', accountId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                logger.error('Failed to fetch client notes', error, { component: 'useClientNotes', clientId, accountId });
                throw error;
            }
            return data as CRMNote[];
        },
        enabled: !!clientId && !!accountId,
    });
}

export function useCreateNote() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async ({ clientId, values }: { clientId: string; values: NoteFormValues & { account_id?: string } }) => {
            const finalAccountId = values.account_id || accountId;

            if (!finalAccountId) {
                throw new Error('Account ID is required to create a note');
            }

            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('crm_notes')
                .insert({
                    account_id: finalAccountId,
                    client_id: clientId,
                    note_text: values.note_text,
                    created_by_user_id: user?.id,
                })
                .select()
                .maybeSingle();

            if (error) {
                logger.error('Failed to create note', error, { component: 'useCreateNote', accountId: finalAccountId, clientId });
                throw error;
            }
            return data as CRMNote;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: crmNoteKeys.byClient(variables.clientId) });
            toast.success('Note added successfully');
        },
        onError: (error: unknown) => {
            logger.error('Note creation failed', error, { component: 'useCreateNote' });
            toast.error(humanizeError(error, 'Failed to add note'));
        },
    });
}
