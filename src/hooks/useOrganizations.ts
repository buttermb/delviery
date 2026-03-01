/**
 * useOrganizations Hook
 *
 * Manages customer organizations/groups for B2B wholesale relationships.
 * Supports:
 * - Organization CRUD operations
 * - Member management (add/remove customers)
 * - Organization-level analytics (LTV, order stats)
 * - Group pricing rules
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';

import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

import { queryKeys } from '@/lib/queryKeys';
import type {
  Organization,
  OrganizationWithStats,
  OrganizationMember,
  OrganizationFormValues,
  AddMemberFormValues,
  OrganizationFilters,
  OrganizationSortOptions,
  OrganizationStatus,
} from '@/types/organization';

// ============================================================================
// Query Keys
// ============================================================================

export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: (tenantId: string, filters?: OrganizationFilters) =>
    [...organizationKeys.lists(), tenantId, filters] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (tenantId: string, orgId: string) =>
    [...organizationKeys.details(), tenantId, orgId] as const,
  members: (tenantId: string, orgId: string) =>
    [...organizationKeys.detail(tenantId, orgId), 'members'] as const,
  stats: (tenantId: string, orgId: string) =>
    [...organizationKeys.detail(tenantId, orgId), 'stats'] as const,
  search: (tenantId: string, query: string) =>
    [...organizationKeys.all, 'search', tenantId, query] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseOrganizationsOptions {
  filters?: OrganizationFilters;
  sort?: OrganizationSortOptions;
  enabled?: boolean;
}

export interface UseOrganizationDetailOptions {
  organizationId: string | undefined;
  enabled?: boolean;
}

export interface UseOrganizationsReturn {
  // List data
  organizations: OrganizationWithStats[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;

  // Mutations
  createOrganization: (data: OrganizationFormValues) => Promise<Organization | null>;
  updateOrganization: (id: string, data: Partial<OrganizationFormValues>) => Promise<Organization | null>;
  deleteOrganization: (id: string) => Promise<boolean>;
  updateStatus: (id: string, status: OrganizationStatus) => Promise<boolean>;

  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export interface UseOrganizationDetailReturn {
  organization: OrganizationWithStats | null;
  members: OrganizationMember[];
  isLoading: boolean;
  isLoadingMembers: boolean;
  error: Error | null;
  refetch: () => void;
  refetchMembers: () => void;

  // Member mutations
  addMember: (data: AddMemberFormValues) => Promise<OrganizationMember | null>;
  removeMember: (memberId: string) => Promise<boolean>;
  updateMember: (memberId: string, data: Partial<AddMemberFormValues>) => Promise<OrganizationMember | null>;

  // Mutation states
  isAddingMember: boolean;
  isRemovingMember: boolean;
  isUpdatingMember: boolean;
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function fetchOrganizations(
  tenantId: string,
  filters?: OrganizationFilters
): Promise<OrganizationWithStats[]> {
  let query = supabase
    .from('customer_organizations')
    .select('id, tenant_id, name, legal_name, organization_type, status, email, phone, website, address_line1, address_line2, city, state, postal_code, country, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_id, payment_terms, license_number, license_type, license_expiration, pricing_tier_id, discount_percentage, notes, created_at, updated_at, created_by')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.organization_type) {
    query = query.eq('organization_type', filters.organization_type);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${escapePostgresLike(filters.search)}%,legal_name.ilike.%${escapePostgresLike(filters.search)}%`);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch organizations', error, {
      tenantId,
      filters,
      component: 'useOrganizations',
    });
    throw error;
  }

  // Fetch stats for each organization
  const orgsWithStats: OrganizationWithStats[] = [];

  interface OrgRow { id: string; [key: string]: unknown }

  for (const org of (data ?? []) as OrgRow[]) {
    // Get member count
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('organization_id', org.id);

    // Get orders and LTV data
    const { data: orderStats } = await supabase
      .from('unified_orders')
      .select('total_amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('organization_id', org.id)
      .in('status', ['completed', 'delivered', 'paid']);

    const validOrders = orderStats ?? [];
    const totalLtv = validOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    const totalOrders = validOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalLtv / totalOrders : 0;

    // Find last order date
    let lastOrderDate: string | null = null;
    if (validOrders.length > 0) {
      const sorted = [...validOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastOrderDate = sorted[0].created_at;
    }

    orgsWithStats.push({
      ...org,
      member_count: memberCount ?? 0,
      total_ltv: Math.round(totalLtv * 100) / 100,
      total_orders: totalOrders,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      last_order_date: lastOrderDate,
    } as OrganizationWithStats);
  }

  return orgsWithStats;
}

async function fetchOrganizationDetail(
  tenantId: string,
  orgId: string
): Promise<OrganizationWithStats | null> {
  const { data: org, error } = await supabase
    .from('customer_organizations')
    .select('id, tenant_id, name, legal_name, organization_type, status, email, phone, website, address_line1, address_line2, city, state, postal_code, country, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_id, payment_terms, license_number, license_type, license_expiration, pricing_tier_id, discount_percentage, notes, created_at, updated_at, created_by')
    .eq('tenant_id', tenantId)
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch organization detail', error, {
      tenantId,
      orgId,
      component: 'useOrganizations',
    });
    throw error;
  }

  if (!org) return null;

  // Get member count
  const { count: memberCount } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('organization_id', (org as Record<string, unknown>).id);

  // Get orders and LTV data
  const { data: orderStats } = await supabase
    .from('unified_orders')
    .select('total_amount, created_at')
    .eq('tenant_id', tenantId)
    .eq('organization_id', (org as Record<string, unknown>).id)
    .in('status', ['completed', 'delivered', 'paid']);

  const validOrders = orderStats ?? [];
  const totalLtv = validOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const totalOrders = validOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalLtv / totalOrders : 0;

  let lastOrderDate: string | null = null;
  if (validOrders.length > 0) {
    const sorted = [...validOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    lastOrderDate = sorted[0].created_at;
  }

  return {
    ...(org as Record<string, unknown>),
    member_count: memberCount ?? 0,
    total_ltv: Math.round(totalLtv * 100) / 100,
    total_orders: totalOrders,
    avg_order_value: Math.round(avgOrderValue * 100) / 100,
    last_order_date: lastOrderDate,
  } as unknown as OrganizationWithStats;
}

async function fetchOrganizationMembers(
  tenantId: string,
  orgId: string
): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      id, tenant_id, organization_id, customer_id, role, is_primary_contact, can_place_orders, can_view_invoices, can_manage_members, joined_at, created_at, updated_at,
      customer:customers!organization_members_customer_id_fkey(
        id,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('organization_id', orgId)
    .order('is_primary_contact', { ascending: false })
    .order('role', { ascending: true });

  if (error) {
    // Try simpler query without joins
    logger.warn('Failed to fetch members with customer join, trying simpler query', error, {
      component: 'useOrganizations',
    });

    const { data: simpleData, error: simpleError } = await supabase
      .from('organization_members')
      .select('id, tenant_id, organization_id, customer_id, role, is_primary_contact, can_place_orders, can_view_invoices, can_manage_members, joined_at, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('organization_id', orgId)
      .order('is_primary_contact', { ascending: false });

    if (simpleError) {
      logger.error('Failed to fetch organization members', simpleError, {
        tenantId,
        orgId,
        component: 'useOrganizations',
      });
      throw simpleError;
    }

    return (simpleData ?? []) as OrganizationMember[];
  }

  return (data ?? []) as OrganizationMember[];
}

// ============================================================================
// Main Hook: useOrganizations (List)
// ============================================================================

export function useOrganizations({
  filters,
  enabled = true,
}: UseOrganizationsOptions = {}): UseOrganizationsReturn {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch organizations list
  const {
    data: organizations,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: organizationKeys.list(tenantId ?? '', filters),
    queryFn: () => fetchOrganizations(tenantId!, filters),
    enabled: enabled && !!tenantId,
    staleTime: 60000, // 1 minute
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: OrganizationFormValues): Promise<Organization> => {
      if (!tenantId) throw new Error('No tenant context');

      const { data: created, error } = await supabase
        .from('customer_organizations')
        .insert({
          tenant_id: tenantId,
          name: data.name,
          legal_name: data.legal_name || null,
          organization_type: data.organization_type,
          status: data.status || 'active',
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          address_line1: data.address_line1 || null,
          address_line2: data.address_line2 || null,
          city: data.city || null,
          state: data.state || null,
          postal_code: data.postal_code || null,
          country: data.country || null,
          billing_email: data.billing_email || null,
          billing_address_line1: data.billing_address_line1 || null,
          billing_address_line2: data.billing_address_line2 || null,
          billing_city: data.billing_city || null,
          billing_state: data.billing_state || null,
          billing_postal_code: data.billing_postal_code || null,
          billing_country: data.billing_country || null,
          tax_id: data.tax_id || null,
          payment_terms: data.payment_terms || null,
          license_number: data.license_number || null,
          license_type: data.license_type || null,
          license_expiration: data.license_expiration || null,
          pricing_tier_id: data.pricing_tier_id || null,
          discount_percentage: data.discount_percentage || null,
          notes: data.notes || null,
          created_by: admin?.id || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create organization', error, {
          tenantId,
          name: data.name,
          component: 'useOrganizations',
        });
        throw error;
      }

      logger.info('Organization created', {
        tenantId,
        organizationId: created.id,
        name: data.name,
        component: 'useOrganizations',
      });

      return created as Organization;
    },
    onSuccess: () => {
      toast.success('Organization created successfully');
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create organization'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<OrganizationFormValues>;
    }): Promise<Organization> => {
      if (!tenantId) throw new Error('No tenant context');

      const { data: updated, error } = await supabase
        .from('customer_organizations')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update organization', error, {
          tenantId,
          organizationId: id,
          component: 'useOrganizations',
        });
        throw error;
      }

      logger.info('Organization updated', {
        tenantId,
        organizationId: id,
        component: 'useOrganizations',
      });

      return updated as Organization;
    },
    onSuccess: (_data, variables) => {
      toast.success('Organization updated successfully');
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.detail(tenantId!, variables.id),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update organization'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!tenantId) throw new Error('No tenant context');

      // First remove all members
      await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', id)
        .eq('tenant_id', tenantId);

      // Then delete organization
      const { error } = await supabase
        .from('customer_organizations')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete organization', error, {
          tenantId,
          organizationId: id,
          component: 'useOrganizations',
        });
        throw error;
      }

      logger.info('Organization deleted', {
        tenantId,
        organizationId: id,
        component: 'useOrganizations',
      });
    },
    onSuccess: () => {
      toast.success('Organization deleted successfully');
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete organization'));
    },
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: OrganizationStatus;
    }): Promise<void> => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('customer_organizations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to update organization status', error, {
          tenantId,
          organizationId: id,
          status,
          component: 'useOrganizations',
        });
        throw error;
      }

      logger.info('Organization status updated', {
        tenantId,
        organizationId: id,
        status,
        component: 'useOrganizations',
      });
    },
    onSuccess: (_data, variables) => {
      toast.success('Organization status updated successfully');
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.detail(tenantId!, variables.id),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update organization status'));
    },
  });

  // Wrapped mutation functions
  const createOrganization = useCallback(
    async (data: OrganizationFormValues): Promise<Organization | null> => {
      try {
        return await createMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    [createMutation]
  );

  const updateOrganization = useCallback(
    async (id: string, data: Partial<OrganizationFormValues>): Promise<Organization | null> => {
      try {
        return await updateMutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    [updateMutation]
  );

  const deleteOrganization = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    [deleteMutation]
  );

  const updateStatus = useCallback(
    async (id: string, status: OrganizationStatus): Promise<boolean> => {
      try {
        await statusMutation.mutateAsync({ id, status });
        return true;
      } catch {
        return false;
      }
    },
    [statusMutation]
  );

  return {
    organizations: organizations ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    updateStatus,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================================================
// Detail Hook: useOrganizationDetail
// ============================================================================

export function useOrganizationDetail({
  organizationId,
  enabled = true,
}: UseOrganizationDetailOptions): UseOrganizationDetailReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch organization detail
  const {
    data: organization,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: organizationKeys.detail(tenantId ?? '', organizationId ?? ''),
    queryFn: () => fetchOrganizationDetail(tenantId!, organizationId!),
    enabled: enabled && !!tenantId && !!organizationId,
    staleTime: 60000,
  });

  // Fetch members
  const {
    data: members,
    isLoading: isLoadingMembers,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: organizationKeys.members(tenantId ?? '', organizationId ?? ''),
    queryFn: () => fetchOrganizationMembers(tenantId!, organizationId!),
    enabled: enabled && !!tenantId && !!organizationId,
    staleTime: 30000,
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: AddMemberFormValues): Promise<OrganizationMember> => {
      if (!tenantId || !organizationId) throw new Error('Missing context');

      const { data: member, error } = await supabase
        .from('organization_members')
        .insert({
          tenant_id: tenantId,
          organization_id: organizationId,
          customer_id: data.customer_id,
          role: data.role,
          is_primary_contact: data.is_primary_contact ?? false,
          can_place_orders: data.can_place_orders ?? true,
          can_view_invoices: data.can_view_invoices ?? true,
          can_manage_members: data.can_manage_members ?? false,
          joined_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to add organization member', error, {
          tenantId,
          organizationId,
          customerId: data.customer_id,
          component: 'useOrganizationDetail',
        });
        throw error;
      }

      logger.info('Organization member added', {
        tenantId,
        organizationId,
        customerId: data.customer_id,
        component: 'useOrganizationDetail',
      });

      return member as OrganizationMember;
    },
    onSuccess: () => {
      toast.success('Member added successfully');
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(tenantId!, organizationId!),
      });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.detail(tenantId!, organizationId!),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to add member'));
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to remove organization member', error, {
          tenantId,
          memberId,
          component: 'useOrganizationDetail',
        });
        throw error;
      }

      logger.info('Organization member removed', {
        tenantId,
        memberId,
        component: 'useOrganizationDetail',
      });
    },
    onSuccess: () => {
      toast.success('Member removed successfully');
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(tenantId!, organizationId!),
      });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.detail(tenantId!, organizationId!),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to remove member'));
    },
  });

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      data,
    }: {
      memberId: string;
      data: Partial<AddMemberFormValues>;
    }): Promise<OrganizationMember> => {
      if (!tenantId) throw new Error('No tenant context');

      const { data: updated, error } = await supabase
        .from('organization_members')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update organization member', error, {
          tenantId,
          memberId,
          component: 'useOrganizationDetail',
        });
        throw error;
      }

      logger.info('Organization member updated', {
        tenantId,
        memberId,
        component: 'useOrganizationDetail',
      });

      return updated as OrganizationMember;
    },
    onSuccess: () => {
      toast.success('Member updated successfully');
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(tenantId!, organizationId!),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update member'));
    },
  });

  // Wrapped mutation functions
  const addMember = useCallback(
    async (data: AddMemberFormValues): Promise<OrganizationMember | null> => {
      try {
        return await addMemberMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    [addMemberMutation]
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      try {
        await removeMemberMutation.mutateAsync(memberId);
        return true;
      } catch {
        return false;
      }
    },
    [removeMemberMutation]
  );

  const updateMember = useCallback(
    async (memberId: string, data: Partial<AddMemberFormValues>): Promise<OrganizationMember | null> => {
      try {
        return await updateMemberMutation.mutateAsync({ memberId, data });
      } catch {
        return null;
      }
    },
    [updateMemberMutation]
  );

  return {
    organization: organization ?? null,
    members: members ?? [],
    isLoading,
    isLoadingMembers,
    error: error as Error | null,
    refetch,
    refetchMembers,
    addMember,
    removeMember,
    updateMember,
    isAddingMember: addMemberMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending,
    isUpdatingMember: updateMemberMutation.isPending,
  };
}

// ============================================================================
// Search Hook
// ============================================================================

export function useOrganizationSearch(searchTerm: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: organizationKeys.search(tenantId ?? '', searchTerm),
    queryFn: async () => {
      if (!tenantId || !searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('customer_organizations')
        .select('id, name, legal_name, organization_type, status')
        .eq('tenant_id', tenantId)
        .or(`name.ilike.%${escapePostgresLike(searchTerm)}%,legal_name.ilike.%${escapePostgresLike(searchTerm)}%`)
        .eq('status', 'active')
        .limit(10);

      if (error) {
        logger.error('Failed to search organizations', error, {
          tenantId,
          searchTerm,
          component: 'useOrganizationSearch',
        });
        return [];
      }

      return data ?? [];
    },
    enabled: !!tenantId && !!searchTerm && searchTerm.length >= 2,
    staleTime: 30000,
  });

  return {
    results: data ?? [],
    isSearching: isLoading,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get organizations for a specific customer
 */
export function useCustomerOrganizations(customerId: string | undefined) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.customerOrganizations.byCustomer(tenantId, customerId),
    queryFn: async () => {
      if (!tenantId || !customerId) return [];

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id, tenant_id, organization_id, customer_id, role, is_primary_contact, can_place_orders, can_view_invoices, can_manage_members, joined_at, created_at, updated_at,
          organization:customer_organizations!organization_members_organization_id_fkey(
            id,
            name,
            organization_type,
            status
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId);

      if (error) {
        logger.error('Failed to fetch customer organizations', error, {
          tenantId,
          customerId,
          component: 'useCustomerOrganizations',
        });
        return [];
      }

      return data ?? [];
    },
    enabled: !!tenantId && !!customerId,
  });

  interface MemberWithOrg {
    organization?: Record<string, unknown> | null;
    [key: string]: unknown;
  }

  const organizations = useMemo(() => {
    return (data ?? [])
      .filter((m: MemberWithOrg) => m.organization)
      .map((m: MemberWithOrg) => ({
        membership: m,
        organization: m.organization,
      }));
  }, [data]);

  return {
    organizations,
    isLoading,
    error: error as Error | null,
  };
}
