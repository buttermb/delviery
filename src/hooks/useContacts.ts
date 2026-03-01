/**
 * Unified Contacts Hook
 * 
 * Single hook for all contact types (retail, wholesale, crm)
 * with real-time subscriptions and optimistic updates.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { toast } from 'sonner';
import { invalidateOnEvent } from '@/lib/invalidation';

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

  const queryKey = contactsKeys.list(tenant?.id ?? '', { contactType, status, search, limit, offset });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      let query = supabase
        .from('contacts')
        .select('id, tenant_id, contact_type, name, first_name, last_name, email, phone, address, city, state, zip_code, country, auth_user_id, business_name, business_license, tax_id, credit_limit, outstanding_balance, payment_terms, client_type, account_manager_id, lead_status, lead_source, assigned_to, company_name, job_title, loyalty_points, loyalty_tier, lifetime_value, total_orders, is_verified, verified_at, age_verified, status, email_opt_in, sms_opt_in, preferred_contact_method, notes, tags, metadata, created_at, updated_at, last_contacted_at, last_order_at')
        .eq('tenant_id', tenant.id)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (contactType) {
        query = query.contains('contact_type', [contactType]);
      }
      if (search) {
        query = query.or(
          `name.ilike.%${escapePostgresLike(search)}%,email.ilike.%${escapePostgresLike(search)}%,business_name.ilike.%${escapePostgresLike(search)}%,phone.ilike.%${escapePostgresLike(search)}%`
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
    queryKey: contactsKeys.detail(contactId ?? ''),
    queryFn: async () => {
      if (!tenant?.id || !contactId) throw new Error('Missing tenant or contact ID');

      const { data, error } = await supabase
        .from('contacts')
        .select('id, tenant_id, contact_type, name, first_name, last_name, email, phone, address, city, state, zip_code, country, auth_user_id, business_name, business_license, tax_id, credit_limit, outstanding_balance, payment_terms, client_type, account_manager_id, lead_status, lead_source, assigned_to, company_name, job_title, loyalty_points, loyalty_tier, lifetime_value, total_orders, is_verified, verified_at, age_verified, status, email_opt_in, sms_opt_in, preferred_contact_method, notes, tags, metadata, created_at, updated_at, last_contacted_at, last_order_at')
        .eq('id', contactId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

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

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenant.id,
          ...input,
          contact_type: input.contact_type || ['retail'],
          metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create contact', { error });
        throw error;
      }

      return data as Contact;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: contactsKeys.lists() });
      const previousContacts = queryClient.getQueriesData<Contact[]>({ queryKey: contactsKeys.lists() });

      const optimisticContact: Contact = {
        id: `temp-${Date.now()}`,
        tenant_id: tenant?.id ?? '',
        contact_type: input.contact_type || ['retail'],
        name: input.name || null,
        first_name: input.first_name || null,
        last_name: input.last_name || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        zip_code: input.zip_code || null,
        country: 'US',
        auth_user_id: null,
        business_name: input.business_name || null,
        business_license: null,
        tax_id: null,
        credit_limit: input.credit_limit || 0,
        outstanding_balance: 0,
        payment_terms: input.payment_terms || 'net_30',
        client_type: input.client_type || null,
        account_manager_id: null,
        lead_status: input.lead_status || null,
        lead_source: input.lead_source || null,
        assigned_to: null,
        company_name: input.company_name || null,
        job_title: input.job_title || null,
        loyalty_points: 0,
        loyalty_tier: null,
        lifetime_value: 0,
        total_orders: 0,
        is_verified: false,
        verified_at: null,
        age_verified: false,
        status: 'active',
        email_opt_in: false,
        sms_opt_in: false,
        preferred_contact_method: 'email',
        notes: input.notes || null,
        tags: input.tags || null,
        metadata: input.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_contacted_at: null,
        last_order_at: null,
      };

      queryClient.setQueriesData<Contact[]>(
        { queryKey: contactsKeys.lists() },
        (old) => old ? [optimisticContact, ...old] : [optimisticContact]
      );

      return { previousContacts };
    },
    onError: (error, _input, context) => {
      if (context?.previousContacts) {
        context.previousContacts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to create contact';
      logger.error('Contact creation failed', error, { component: 'useCreateContact' });
      toast.error('Contact creation failed', { description: message });
    },
    onSuccess: (data) => {
      toast.success('Contact created successfully');
      // Cross-panel invalidation - new contact affects CRM, dashboard, analytics
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'CUSTOMER_CREATED', tenant.id, {
          customerId: data.id,
        });
      }
    },
    onSettled: () => {
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

      const updateData = {
        ...input,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      };

      const { data, error } = await supabase
        .from('contacts')
        .update(updateData as Record<string, unknown>)
        .eq('id', contactId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update contact', { contactId, error });
        throw error;
      }

      return data as Contact;
    },
    onMutate: async ({ contactId, ...input }) => {
      await queryClient.cancelQueries({ queryKey: contactsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: contactsKeys.detail(contactId) });

      const previousLists = queryClient.getQueriesData<Contact[]>({ queryKey: contactsKeys.lists() });
      const previousDetail = queryClient.getQueryData<Contact>(contactsKeys.detail(contactId));

      // Update list caches optimistically
      queryClient.setQueriesData<Contact[]>(
        { queryKey: contactsKeys.lists() },
        (old) => old?.map(contact =>
          contact.id === contactId ? { ...contact, ...input, updated_at: new Date().toISOString() } : contact
        )
      );

      // Update detail cache
      if (previousDetail) {
        queryClient.setQueryData<Contact>(
          contactsKeys.detail(contactId),
          { ...previousDetail, ...input, updated_at: new Date().toISOString() }
        );
      }

      return { previousLists, previousDetail, contactId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail && context.contactId) {
        queryClient.setQueryData(contactsKeys.detail(context.contactId), context.previousDetail);
      }
      const message = error instanceof Error ? error.message : 'Failed to update contact';
      logger.error('Contact update failed', error, { component: 'useUpdateContact' });
      toast.error('Contact update failed', { description: message });
    },
    onSuccess: (data) => {
      toast.success('Contact updated successfully');
      // Cross-panel invalidation - customer update affects CRM, orders, collections
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'CUSTOMER_UPDATED', tenant.id, {
          customerId: data.id,
        });
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(variables.contactId) });
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
    onMutate: async (contactId) => {
      await queryClient.cancelQueries({ queryKey: contactsKeys.lists() });
      const previousContacts = queryClient.getQueriesData<Contact[]>({ queryKey: contactsKeys.lists() });

      // Optimistically remove from active lists
      queryClient.setQueriesData<Contact[]>(
        { queryKey: contactsKeys.lists() },
        (old) => old?.filter(contact => contact.id !== contactId)
      );

      return { previousContacts };
    },
    onError: (error, _contactId, context) => {
      if (context?.previousContacts) {
        context.previousContacts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to delete contact';
      logger.error('Contact deletion failed', error, { component: 'useDeleteContact' });
      toast.error('Contact deletion failed', { description: message });
    },
    onSuccess: (contactId) => {
      toast.success('Contact deleted successfully');
      // Cross-panel invalidation - customer deletion affects CRM, analytics
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'CUSTOMER_DELETED', tenant.id, {
          customerId: contactId,
        });
      }
    },
    onSettled: () => {
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
    onMutate: async ({ contactId, amount, operation }) => {
      await queryClient.cancelQueries({ queryKey: contactsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: contactsKeys.detail(contactId) });

      const previousLists = queryClient.getQueriesData<Contact[]>({ queryKey: contactsKeys.lists() });
      const previousDetail = queryClient.getQueryData<Contact>(contactsKeys.detail(contactId));

      const balanceChange = operation === 'add' ? amount : -amount;

      queryClient.setQueriesData<Contact[]>(
        { queryKey: contactsKeys.lists() },
        (old) => old?.map(contact =>
          contact.id === contactId
            ? { ...contact, outstanding_balance: contact.outstanding_balance + balanceChange }
            : contact
        )
      );

      if (previousDetail) {
        queryClient.setQueryData<Contact>(
          contactsKeys.detail(contactId),
          { ...previousDetail, outstanding_balance: previousDetail.outstanding_balance + balanceChange }
        );
      }

      return { previousLists, previousDetail, contactId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail && context.contactId) {
        queryClient.setQueryData(contactsKeys.detail(context.contactId), context.previousDetail);
      }
      const message = error instanceof Error ? error.message : 'Failed to update balance';
      logger.error('Balance update failed', error, { component: 'useUpdateContactBalance' });
      toast.error('Balance update failed', { description: message });
    },
    onSuccess: ({ contactId }) => {
      toast.success('Balance updated successfully');
      // Cross-panel invalidation - balance change affects finance, collections, CRM
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'PAYMENT_RECEIVED', tenant.id, {
          customerId: contactId,
        });
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(variables.contactId) });
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
    onMutate: async ({ contactId, contactType }) => {
      await queryClient.cancelQueries({ queryKey: contactsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: contactsKeys.detail(contactId) });

      const previousLists = queryClient.getQueriesData<Contact[]>({ queryKey: contactsKeys.lists() });
      const previousDetail = queryClient.getQueryData<Contact>(contactsKeys.detail(contactId));

      // Optimistically add the contact type
      queryClient.setQueriesData<Contact[]>(
        { queryKey: contactsKeys.lists() },
        (old) => old?.map(contact =>
          contact.id === contactId
            ? { ...contact, contact_type: [...(contact.contact_type ?? []), contactType] }
            : contact
        )
      );

      if (previousDetail) {
        queryClient.setQueryData<Contact>(
          contactsKeys.detail(contactId),
          { ...previousDetail, contact_type: [...(previousDetail.contact_type ?? []), contactType] }
        );
      }

      return { previousLists, previousDetail, contactId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail && context.contactId) {
        queryClient.setQueryData(contactsKeys.detail(context.contactId), context.previousDetail);
      }
      const message = error instanceof Error ? error.message : 'Failed to add contact type';
      logger.error('Add contact type failed', error, { component: 'useAddContactType' });
      toast.error('Failed to add contact type', { description: message });
    },
    onSuccess: () => {
      toast.success('Contact type added successfully');
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(variables.contactId) });
    },
  });
}

/**
 * Hook to get contact statistics
 */
export function useContactStats(contactType?: ContactType) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.contactsStats.byTenantType(tenant?.id, contactType),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

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
        totalOutstanding: data.reduce((sum, c) => sum + (c.outstanding_balance ?? 0), 0),
        totalLifetimeValue: data.reduce((sum, c) => sum + (c.lifetime_value ?? 0), 0),
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

