/**
 * Vendor Contacts Hook
 *
 * Manages multiple contacts per vendor with CRUD operations.
 * Supports different departments (sales, billing, logistics, etc.)
 * Primary contact auto-selection for PO communications.
 * Contact history logging for interactions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export type ContactDepartment = 'sales' | 'billing' | 'logistics' | 'support' | 'management' | 'other';
export type ContactHistoryAction = 'call' | 'email' | 'meeting' | 'note';

export interface VendorContact {
  id: string;
  tenant_id: string;
  vendor_id: string;
  name: string;
  role: string | null;
  department: ContactDepartment | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorContactHistory {
  id: string;
  tenant_id: string;
  vendor_contact_id: string;
  action: ContactHistoryAction;
  summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateVendorContactInput {
  vendor_id: string;
  name: string;
  role?: string;
  department?: ContactDepartment;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateVendorContactInput {
  id: string;
  name?: string;
  role?: string;
  department?: ContactDepartment;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface CreateContactHistoryInput {
  vendor_contact_id: string;
  action: ContactHistoryAction;
  summary?: string;
}

// ============================================================================
// Hook: useVendorContacts
// ============================================================================

export function useVendorContacts(vendorId: string) {
  const { tenant, admin: user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch all contacts for a vendor
  const contactsQuery = useQuery({
    queryKey: queryKeys.vendors.contacts(tenantId ?? '', vendorId),
    queryFn: async (): Promise<VendorContact[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_contacts')
        .select('id, tenant_id, vendor_id, name, role, department, phone, email, is_primary, notes, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch vendor contacts', error, {
          component: 'useVendorContacts',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorContact[];
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (input: CreateVendorContactInput): Promise<VendorContact> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_contacts')
        .insert({
          tenant_id: tenantId,
          vendor_id: input.vendor_id,
          name: input.name,
          role: input.role ?? null,
          department: input.department ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          is_primary: input.is_primary ?? false,
          notes: input.notes ?? null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create vendor contact', error, {
          component: 'useVendorContacts',
          tenantId,
          vendorId: input.vendor_id,
        });
        throw error;
      }

      return data as VendorContact;
    },
    onSuccess: () => {
      toast.success('Contact created successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.contacts(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create contact'));
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (input: UpdateVendorContactInput): Promise<VendorContact> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.is_primary !== undefined) updateData.is_primary = input.is_primary;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('vendor_contacts')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update vendor contact', error, {
          component: 'useVendorContacts',
          tenantId,
          contactId: input.id,
        });
        throw error;
      }

      return data as VendorContact;
    },
    onSuccess: () => {
      toast.success('Contact updated successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.contacts(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update contact'));
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { error } = await supabase
        .from('vendor_contacts')
        .delete()
        .eq('id', contactId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete vendor contact', error, {
          component: 'useVendorContacts',
          tenantId,
          contactId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Contact deleted successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.contacts(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete contact'));
    },
  });

  // Set as primary mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (contactId: string): Promise<VendorContact> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_contacts')
        .update({ is_primary: true })
        .eq('id', contactId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to set primary vendor contact', error, {
          component: 'useVendorContacts',
          tenantId,
          contactId,
        });
        throw error;
      }

      return data as VendorContact;
    },
    onSuccess: () => {
      toast.success('Primary contact updated');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.contacts(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to set primary contact'));
    },
  });

  // Log contact interaction mutation
  const logInteractionMutation = useMutation({
    mutationFn: async (input: CreateContactHistoryInput): Promise<VendorContactHistory> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_contact_history')
        .insert({
          tenant_id: tenantId,
          vendor_contact_id: input.vendor_contact_id,
          action: input.action,
          summary: input.summary ?? null,
          created_by: user?.id ?? null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to log contact interaction', error, {
          component: 'useVendorContacts',
          tenantId,
          contactId: input.vendor_contact_id,
        });
        throw error;
      }

      return data as VendorContactHistory;
    },
    onSuccess: (_, variables) => {
      toast.success('Interaction logged successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.contactHistory(tenantId ?? '', variables.vendor_contact_id),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to log interaction'));
    },
  });

  // Get primary contact helper
  const primaryContact = contactsQuery.data?.find(c => c.is_primary) ?? null;

  return {
    // Query data
    contacts: contactsQuery.data ?? [],
    primaryContact,
    isLoading: contactsQuery.isLoading,
    isError: contactsQuery.isError,
    error: contactsQuery.error,

    // Mutations
    createContact: createContactMutation.mutateAsync,
    updateContact: updateContactMutation.mutateAsync,
    deleteContact: deleteContactMutation.mutateAsync,
    setPrimary: setPrimaryMutation.mutateAsync,
    logInteraction: logInteractionMutation.mutateAsync,

    // Mutation states
    isCreating: createContactMutation.isPending,
    isUpdating: updateContactMutation.isPending,
    isDeleting: deleteContactMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
  };
}

// ============================================================================
// Hook: useVendorContactHistory
// ============================================================================

export function useVendorContactHistory(contactId: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.vendors.contactHistory(tenantId ?? '', contactId),
    queryFn: async (): Promise<VendorContactHistory[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_contact_history')
        .select('id, tenant_id, vendor_contact_id, action, summary, created_by, created_at')
        .eq('tenant_id', tenantId)
        .eq('vendor_contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch contact history', error, {
          component: 'useVendorContactHistory',
          tenantId,
          contactId,
        });
        throw error;
      }

      return (data ?? []) as VendorContactHistory[];
    },
    enabled: !!tenantId && !!contactId,
  });
}

// ============================================================================
// Department Labels
// ============================================================================

export const DEPARTMENT_LABELS: Record<ContactDepartment, string> = {
  sales: 'Sales',
  billing: 'Billing',
  logistics: 'Logistics',
  support: 'Support',
  management: 'Management',
  other: 'Other',
};

export const DEPARTMENT_OPTIONS = Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({
  value: value as ContactDepartment,
  label,
}));

export const HISTORY_ACTION_LABELS: Record<ContactHistoryAction, string> = {
  call: 'Phone Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
};
