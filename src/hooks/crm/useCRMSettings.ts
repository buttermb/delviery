import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMSettings, FAQ } from '@/types/crm';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';

export const crmSettingsKeys = {
    all: ['crm-settings'] as const,
    detail: () => [...crmSettingsKeys.all, 'detail'] as const,
};

export function useCRMSettings() {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmSettingsKeys.detail(),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            // First try to get settings
            const { data, error } = await supabase
                .from('crm_settings')
                .select('*')
                .eq('account_id', accountId)
                .maybeSingle();

            if (error) {
                logger.error('Failed to fetch CRM settings', error, { component: 'useCRMSettings', accountId });
                throw error;
            }

            // If no settings exist, create default record
            if (!data) {
                const { data: newData, error: createError } = await supabase
                    .from('crm_settings')
                    .insert({ account_id: accountId })
                    .select()
                    .single();

                if (createError) {
                    logger.error('Failed to create CRM settings', createError, { component: 'useCRMSettings', accountId });
                    throw createError;
                }
                return {
                    ...newData,
                    faqs: Array.isArray(newData.faqs) ? (newData.faqs as unknown as FAQ[]) : [],
                } as CRMSettings;
            }

            return {
                ...data,
                faqs: Array.isArray(data.faqs) ? (data.faqs as unknown as FAQ[]) : [],
            } as CRMSettings;
        },
        enabled: !!accountId,
    });
}

export function useUpdateCRMSettings() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (values: Partial<CRMSettings>) => {
            if (!accountId) {
                throw new Error('Account ID is required to update settings');
            }

            // Fetch the current settings to get the ID
            const { data: currentSettings, error: fetchError } = await supabase
                .from('crm_settings')
                .select('id')
                .eq('account_id', accountId)
                .maybeSingle();

            if (fetchError) {
                logger.error('Failed to fetch CRM settings for update', fetchError, { component: 'useUpdateCRMSettings', accountId });
                throw fetchError;
            }

            if (!currentSettings) {
                // Create settings if they don't exist
                const payload: any = { ...values, account_id: accountId };
                if (values.faqs !== undefined) {
                    payload.faqs = values.faqs as unknown as Json;
                }
                
                const { data: newData, error: createError } = await supabase
                    .from('crm_settings')
                    .insert(payload)
                    .select()
                    .single();

                if (createError) {
                    logger.error('Failed to create CRM settings', createError, { component: 'useUpdateCRMSettings', accountId });
                    throw createError;
                }
                return {
                    ...newData,
                    faqs: Array.isArray(newData.faqs) ? (newData.faqs as unknown as FAQ[]) : [],
                } as CRMSettings;
            }

            const payload: any = { ...values };
            if (values.faqs !== undefined) {
                payload.faqs = values.faqs as unknown as Json;
            }

            const { data, error } = await supabase
                .from('crm_settings')
                .update(payload)
                .eq('id', currentSettings.id)
                .eq('account_id', accountId)
                .select()
                .single();

            if (error) {
                logger.error('Failed to update CRM settings', error, { component: 'useUpdateCRMSettings', accountId, settingsId: currentSettings.id });
                throw error;
            }
            return {
                ...data,
                faqs: Array.isArray(data.faqs) ? (data.faqs as unknown as FAQ[]) : [],
            } as CRMSettings;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: crmSettingsKeys.detail() });
            toast.success('Settings updated successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('CRM settings update failed', error, { component: 'useUpdateCRMSettings' });
            toast.error(`Failed to update settings: ${errorMessage}`);
        },
    });
}
