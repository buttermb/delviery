/**
 * Customer Tags Hook
 *
 * Provides tag management for customer contacts including:
 * - CRUD operations for tags
 * - Assigning/removing tags from contacts
 * - Fetching tags for a specific contact
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// Types
export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerTag {
  id: string;
  tenant_id: string;
  contact_id: string;
  tag_id: string;
  created_at: string;
  tag?: Tag;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagInput {
  id: string;
  name?: string;
  color?: string;
  description?: string;
}

/**
 * Hook to fetch all tags for the current tenant
 */
export function useTags() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.tags.list({ tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('tags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch tags', { error });
        throw error;
      }

      return data as Tag[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch tags for a specific contact
 */
export function useContactTags(contactId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customerTags.byContact(contactId || ''),
    queryFn: async () => {
      if (!tenant?.id || !contactId) throw new Error('No tenant or contact');

      const { data, error } = await (supabase as any)
        .from('customer_tags')
        .select('*, tag:tags(*)')
        .eq('tenant_id', tenant.id)
        .eq('contact_id', contactId);

      if (error) {
        logger.error('Failed to fetch contact tags', { error, contactId });
        throw error;
      }

      return data as CustomerTag[];
    },
    enabled: !!tenant?.id && !!contactId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a new tag
 */
export function useCreateTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('tags')
        .insert({
          tenant_id: tenant.id,
          name: input.name.trim(),
          color: input.color || '#6B7280',
          description: input.description || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create tag', { error, input });
        throw error;
      }

      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success('Tag created successfully');
    },
  });
}

/**
 * Hook to update an existing tag
 */
export function useUpdateTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTagInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.color !== undefined) updateData.color = input.color;
      if (input.description !== undefined) updateData.description = input.description;

      const { data, error } = await (supabase as any)
        .from('tags')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update tag', { error, input });
        throw error;
      }

      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerTags.all });
      toast.success('Tag updated successfully');
    },
  });
}

/**
 * Hook to delete a tag (cascades to customer_tags)
 */
export function useDeleteTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to delete tag', { error, tagId });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerTags.all });
      toast.success('Tag deleted successfully');
    },
  });
}

/**
 * Hook to assign a tag to a contact
 */
export function useAssignTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('customer_tags')
        .insert({
          tenant_id: tenant.id,
          contact_id: contactId,
          tag_id: tagId,
        })
        .select('*, tag:tags(*)')
        .maybeSingle();

      if (error) {
        logger.error('Failed to assign tag', { error, contactId, tagId });
        throw error;
      }

      return data as CustomerTag;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerTags.byContact(variables.contactId),
      });
      toast.success('Tag assigned successfully');
    },
  });
}

/**
 * Hook to remove a tag from a contact
 */
export function useRemoveTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('customer_tags')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) {
        logger.error('Failed to remove tag', { error, contactId, tagId });
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerTags.byContact(variables.contactId),
      });
      toast.success('Tag removed successfully');
    },
  });
}

/**
 * Hook to batch assign tags to multiple contacts
 */
export function useBatchAssignTags() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      tagIds,
    }: {
      contactIds: string[];
      tagIds: string[];
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const insertData = contactIds.flatMap((contactId) =>
        tagIds.map((tagId) => ({
          tenant_id: tenant.id!,
          contact_id: contactId,
          tag_id: tagId,
        }))
      );

      const { error } = await (supabase as any)
        .from('customer_tags')
        .upsert(insertData, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });

      if (error) {
        logger.error('Failed to batch assign tags', { error, contactIds, tagIds });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerTags.all });
      toast.success('Tags assigned successfully');
    },
  });
}
