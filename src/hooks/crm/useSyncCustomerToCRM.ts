/**
 * Customer-CRM Sync Hook
 *
 * Provides functionality to:
 * - Link customers (unified contacts) to CRM clients
 * - Unlink customers from CRM clients
 * - Fetch customer CRM links
 * - Fetch customer CRM activity timeline
 * - Manually log customer activities to CRM
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useAccountIdSafe } from './useAccountId';
import { crmActivityKeys } from './useActivityLog';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import type {
  CRMCustomerLink,
  LinkCustomerToCRMInput,
  CustomerCRMTimelineEntry,
  CRMActivityType,
} from '@/types/crm';

// Query key factory
export const customerCRMKeys = {
  all: ['customer-crm'] as const,
  links: () => [...customerCRMKeys.all, 'links'] as const,
  linksByContact: (contactId: string) => [...customerCRMKeys.links(), 'contact', contactId] as const,
  linksByClient: (clientId: string) => [...customerCRMKeys.links(), 'client', clientId] as const,
  timeline: () => [...customerCRMKeys.all, 'timeline'] as const,
  timelineByContact: (contactId: string, limit?: number) =>
    [...customerCRMKeys.timeline(), 'contact', contactId, limit] as const,
};

/**
 * Hook to fetch CRM links for a specific contact
 */
export function useContactCRMLinks(contactId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: customerCRMKeys.linksByContact(contactId || ''),
    queryFn: async () => {
      if (!contactId || !tenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from('crm_customer_links')
        .select(`
          *,
          crm_client:crm_clients(id, name, email, phone, status)
        `)
        .eq('contact_id', contactId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to fetch contact CRM links', error, {
          component: 'useContactCRMLinks',
          contactId,
        });
        throw error;
      }

      return data as CRMCustomerLink[];
    },
    enabled: !!contactId && !!tenant?.id,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch contacts linked to a specific CRM client
 */
export function useCRMClientContacts(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  return useQuery({
    queryKey: customerCRMKeys.linksByClient(clientId || ''),
    queryFn: async () => {
      if (!clientId || !accountId) return [];

      const { data, error } = await (supabase as any)
        .from('crm_customer_links')
        .select(`
          *,
          contact:contacts(id, name, first_name, last_name, email, phone, status, loyalty_points)
        `)
        .eq('crm_client_id', clientId)
        .eq('account_id', accountId);

      if (error) {
        logger.error('Failed to fetch CRM client contacts', error, {
          component: 'useCRMClientContacts',
          clientId,
        });
        throw error;
      }

      return data as CRMCustomerLink[];
    },
    enabled: !!clientId && !!accountId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch CRM activity timeline for a contact
 */
export function useCustomerCRMTimeline(contactId: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: customerCRMKeys.timelineByContact(contactId || '', limit),
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await (supabase as any).rpc('get_customer_crm_timeline', {
        p_contact_id: contactId,
        p_limit: limit,
        p_offset: 0,
      });

      if (error) {
        logger.error('Failed to fetch customer CRM timeline', error, {
          component: 'useCustomerCRMTimeline',
          contactId,
        });
        throw error;
      }

      return data as unknown as CustomerCRMTimelineEntry[];
    },
    enabled: !!contactId,
    staleTime: 30_000,
  });
}

/**
 * Hook to link a customer to a CRM client
 */
export function useLinkCustomerToCRM() {
  const queryClient = useQueryClient();
  const accountId = useAccountIdSafe();

  return useMutation({
    mutationFn: async (input: LinkCustomerToCRMInput) => {
      const { data, error } = await (supabase as any).rpc('link_customer_to_crm', {
        p_contact_id: input.contact_id,
        p_crm_client_id: input.crm_client_id,
        p_account_id: accountId || undefined,
        p_sync_enabled: input.sync_enabled ?? true,
      });

      if (error) {
        logger.error('Failed to link customer to CRM', error, {
          component: 'useLinkCustomerToCRM',
          input,
        });
        throw error;
      }

      return data as unknown as CRMCustomerLink;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.linksByContact(variables.contact_id),
      });
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.linksByClient(variables.crm_client_id),
      });
      queryClient.invalidateQueries({
        queryKey: crmActivityKeys.byClient(variables.crm_client_id),
      });
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.timelineByContact(variables.contact_id),
      });
      toast.success('Customer linked to CRM successfully');
    },
    onError: (error: unknown) => {
      logger.error('Customer CRM linking failed', error, { component: 'useLinkCustomerToCRM' });
      toast.error('Failed to link customer to CRM', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to unlink a customer from a CRM client
 */
export function useUnlinkCustomerFromCRM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      crmClientId,
    }: {
      contactId: string;
      crmClientId: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('unlink_customer_from_crm', {
        p_contact_id: contactId,
        p_crm_client_id: crmClientId,
      });

      if (error) {
        logger.error('Failed to unlink customer from CRM', error, {
          component: 'useUnlinkCustomerFromCRM',
          contactId,
          crmClientId,
        });
        throw error;
      }

      return data as boolean;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.linksByContact(variables.contactId),
      });
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.linksByClient(variables.crmClientId),
      });
      queryClient.invalidateQueries({
        queryKey: crmActivityKeys.byClient(variables.crmClientId),
      });
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.timelineByContact(variables.contactId),
      });
      toast.success('Customer unlinked from CRM');
    },
    onError: (error: unknown) => {
      logger.error('Customer CRM unlinking failed', error, {
        component: 'useUnlinkCustomerFromCRM',
      });
      toast.error('Failed to unlink customer from CRM', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to toggle sync for a customer-CRM link
 */
export function useToggleCRMSync() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async ({
      linkId,
      syncEnabled,
    }: {
      linkId: string;
      syncEnabled: boolean;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('crm_customer_links')
        .update({ sync_enabled: syncEnabled })
        .eq('id', linkId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to toggle CRM sync', error, {
          component: 'useToggleCRMSync',
          linkId,
          syncEnabled,
        });
        throw error;
      }

      return data as CRMCustomerLink;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: customerCRMKeys.linksByContact(data.contact_id),
        });
        queryClient.invalidateQueries({
          queryKey: customerCRMKeys.linksByClient(data.crm_client_id),
        });
      }
      toast.success(data?.sync_enabled ? 'CRM sync enabled' : 'CRM sync disabled');
    },
    onError: (error: unknown) => {
      logger.error('Toggle CRM sync failed', error, { component: 'useToggleCRMSync' });
      toast.error('Failed to toggle CRM sync', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to manually log an activity to CRM for a customer
 */
export function useLogCustomerCRMActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      activityType,
      description,
      referenceId,
      referenceType,
      metadata,
    }: {
      contactId: string;
      activityType: CRMActivityType;
      description: string;
      referenceId?: string;
      referenceType?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data, error } = await (supabase as any).rpc('log_customer_crm_activity', {
        p_contact_id: contactId,
        p_activity_type: activityType,
        p_description: description,
        p_reference_id: referenceId || null,
        p_reference_type: referenceType || null,
        p_metadata: metadata || {},
      });

      if (error) {
        logger.error('Failed to log customer CRM activity', error, {
          component: 'useLogCustomerCRMActivity',
          contactId,
          activityType,
        });
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerCRMKeys.timelineByContact(variables.contactId),
      });
      // Also invalidate general CRM activity queries
      queryClient.invalidateQueries({
        queryKey: crmActivityKeys.all,
      });
    },
    onError: (error: unknown) => {
      logger.error('Customer CRM activity logging failed', error, {
        component: 'useLogCustomerCRMActivity',
      });
      toast.error('Failed to log activity', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to check if a contact is linked to any CRM client
 */
export function useIsContactLinkedToCRM(contactId: string | undefined) {
  const { data: links, isLoading } = useContactCRMLinks(contactId);

  return {
    isLinked: (links?.length ?? 0) > 0,
    linksCount: links?.length ?? 0,
    isLoading,
    links,
  };
}
