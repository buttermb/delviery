/**
 * Unified Contacts Hook
 * 
 * Single hook for all contact types (retail, wholesale, crm)
 * with real-time subscriptions and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

// Types
export type ContactType = 'retail' | 'wholesale' | 'crm';
export type ContactStatus = 'active' | 'inactive' | 'suspended' | 'blacklisted';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';
export type ClientType = 'sub_dealer' | 'small_shop' | 'network' | 'supplier' | 'distributor' | 'dispensary';

export interface Contact {
  id: string;
  tenant_id: string;
  contact_type: ContactType[];
  // Core info
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  // Auth
  auth_user_id: string | null;
  // Wholesale
  business_name: string | null;
  business_license: string | null;
  tax_id: string | null;
  credit_limit: number;
  outstanding_balance: number;
  payment_terms: string;
  client_type: ClientType | null;
  account_manager_id: string | null;
  // CRM
  lead_status: LeadStatus | null;
  lead_source: string | null;
  assigned_to: string | null;
  company_name: string | null;
  job_title: string | null;
  // Retail/Loyalty
  loyalty_points: number;
  loyalty_tier: LoyaltyTier | null;
  lifetime_value: number;
  total_orders: number;
  // Verification
  is_verified: boolean;
  verified_at: string | null;
  age_verified: boolean;
  // Status
  status: ContactStatus;
  // Communication
  email_opt_in: boolean;
  sms_opt_in: boolean;
  preferred_contact_method: string;
  // General
  notes: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  // Timestamps
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
  last_order_at: string | null;
}

export interface CreateContactInput {
  contact_type?: ContactType[];
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  // Wholesale
  business_name?: string;
  credit_limit?: number;
  payment_terms?: string;
  client_type?: ClientType;
  // CRM
  lead_status?: LeadStatus;
  lead_source?: string;
  company_name?: string;
  job_title?: string;
  // Common
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface UseContactsOptions {
  contactType?: ContactType;
  status?: ContactStatus;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
  realtime?: boolean;
}

// Query key factory
export const contactsKeys = {
  all: ['contacts'] as const,
  lists: () => [...contactsKeys.all, 'list'] as const,
  list: (tenantId: string, filters: Record<string, unknown>) => 
    [...contactsKeys.lists(), tenantId, filters] as const,
  details: () => [...contactsKeys.all, 'detail'] as const,
  detail: (id: string) => [...contactsKeys.details(), id] as const,
};

/**
 * Hook to fetch contacts with optional filtering
 */
export function useContacts(options: UseContactsOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const {
    contactType,
    status = 'active',
    search,
    limit = 50,
    offset = 0,
    enabled = true,
    realtime = true,
  } = options;

  const queryKey = contactsKeys.list(tenant?.id || '', { contactType, status, search, limit, offset });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (contactType) {
        query = query.contains('contact_type', [contactType]);
      }
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,business_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch contacts', { error });
        throw error;
      }

      return data as Contact[];
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 30000,
    gcTime: 300000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !tenant?.id) return;

    const channel = supabase
      .channel(`contacts-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, realtime, queryClient]);

  return query;
}

/**
 * Convenience hook for wholesale clients
 */
export function useWholesaleContactsList(options: Omit<UseContactsOptions, 'contactType'> = {}) {
  return useContacts({ ...options, contactType: 'wholesale' });
}

/**
 * Convenience hook for retail customers
 */
export function useRetailCustomers(options: Omit<UseContactsOptions, 'contactType'> = {}) {
  return useContacts({ ...options, contactType: 'retail' });
}

/**
 * Convenience hook for CRM leads
 */
export function useCRMLeads(options: Omit<UseContactsOptions, 'contactType'> = {}) {
  return useContacts({ ...options, contactType: 'crm' });
}

/**
 * Hook to fetch a single contact by ID
 */
export function useContact(contactId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: contactsKeys.detail(contactId || ''),
    queryFn: async () => {
      if (!tenant?.id || !contactId) throw new Error('Missing tenant or contact ID');

      // @ts-ignore - Table exists after unified architecture migration
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('tenant_id', tenant.id)
        .single();

      if (error) {
        logger.error('Failed to fetch contact', { contactId, error });
        throw error;
      }

      return data as Contact;
    },
    enabled: !!tenant?.id && !!contactId,
  });
}

/**
 * Hook to create a new contact
 */
export function useCreateContact() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenant.id,
          ...input,
          contact_type: input.contact_type || ['retail'],
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create contact', { error });
        throw error;
      }

      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
    },
  });
}

/**
 * Hook to update a contact
 */
export function useUpdateContact() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, ...input }: CreateContactInput & { contactId: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
      const { data, error } = await supabase
        .from('contacts')
        .update(input)
        .eq('id', contactId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update contact', { contactId, error });
        throw error;
      }

      return data as Contact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(data.id) });
    },
  });
}

/**
 * Hook to delete (soft delete) a contact
 */
export function useDeleteContact() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'inactive' })
        .eq('id', contactId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to delete contact', { contactId, error });
        throw error;
      }

      return contactId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
    },
  });
}

/**
 * Hook to update contact balance
 */
export function useUpdateContactBalance() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contactId, 
      amount, 
      operation 
    }: { 
      contactId: string; 
      amount: number; 
      operation: 'add' | 'subtract';
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - RPC exists after unified architecture migration
      const { data: newBalance, error } = await supabase.rpc('update_contact_balance', {
        p_contact_id: contactId,
        p_amount: amount,
        p_operation: operation,
      });

      if (error) {
        logger.error('Failed to update balance', { contactId, amount, operation, error });
        throw error;
      }

      return { contactId, newBalance };
    },
    onSuccess: ({ contactId }) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(contactId) });
    },
  });
}

/**
 * Hook to add a contact type to existing contact
 */
export function useAddContactType() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, contactType }: { contactId: string; contactType: ContactType }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - RPC exists after unified architecture migration
      const { error } = await supabase.rpc('add_contact_type', {
        p_contact_id: contactId,
        p_contact_type: contactType,
      });

      if (error) {
        logger.error('Failed to add contact type', { contactId, contactType, error });
        throw error;
      }

      return { contactId, contactType };
    },
    onSuccess: ({ contactId }) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(contactId) });
    },
  });
}

/**
 * Hook to get contact statistics
 */
export function useContactStats(contactType?: ContactType) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ['contacts-stats', tenant?.id, contactType],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
      let query = supabase
        .from('contacts')
        .select('status, contact_type, outstanding_balance, lifetime_value')
        .eq('tenant_id', tenant.id);

      if (contactType) {
        query = query.contains('contact_type', [contactType]);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch contact stats', { error });
        throw error;
      }

      const stats = {
        total: data.length,
        active: data.filter(c => c.status === 'active').length,
        inactive: data.filter(c => c.status === 'inactive').length,
        suspended: data.filter(c => c.status === 'suspended').length,
        totalOutstanding: data.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0),
        totalLifetimeValue: data.reduce((sum, c) => sum + (c.lifetime_value || 0), 0),
        byType: {
          retail: data.filter(c => c.contact_type?.includes('retail')).length,
          wholesale: data.filter(c => c.contact_type?.includes('wholesale')).length,
          crm: data.filter(c => c.contact_type?.includes('crm')).length,
        },
      };

      return stats;
    },
    enabled: !!tenant?.id,
    staleTime: 60000,
  });
}

