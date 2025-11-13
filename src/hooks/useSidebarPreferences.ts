/**
 * useSidebarPreferences Hook
 * 
 * Manages user sidebar preferences with React Query and optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { SidebarPreferences } from '@/types/sidebar';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

/**
 * Default sidebar preferences
 */
const DEFAULT_PREFERENCES: SidebarPreferences = {
  operationSize: null,
  customLayout: false,
  favorites: [],
  collapsedSections: [],
  pinnedItems: [],
  lastAccessedFeatures: [],
};

/**
 * Hook to get and update sidebar preferences
 */
export function useSidebarPreferences() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['sidebar-preferences', tenant?.id, admin?.id],
    queryFn: async (): Promise<SidebarPreferences> => {
      if (!tenant?.id || !admin?.id) return DEFAULT_PREFERENCES;

      const { data, error } = await supabase
        .from('sidebar_preferences')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('user_id', admin.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch sidebar preferences', error, { component: 'useSidebarPreferences' });
        return DEFAULT_PREFERENCES;
      }

      if (!data) {
        return DEFAULT_PREFERENCES;
      }

      // Parse JSONB fields with safe defaults
      return {
        operationSize: data.operation_size as SidebarPreferences['operationSize'],
        customLayout: data.custom_layout || false,
        favorites: (data.favorites as string[]) || [],
        collapsedSections: (data.collapsed_sections as string[]) || [],
        pinnedItems: (data.pinned_items as string[]) || [],
        lastAccessedFeatures: (data.last_accessed_features as SidebarPreferences['lastAccessedFeatures']) || [],
      };
    },
    enabled: !!tenant?.id && !!admin?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<SidebarPreferences>) => {
      if (!tenant?.id || !admin?.id) throw new Error('Tenant and admin required');

      const current = preferences || DEFAULT_PREFERENCES;
      const updated: SidebarPreferences = {
        ...current,
        ...updates,
      };

      const { error } = await supabase
        .from('sidebar_preferences')
        .upsert([{
          tenant_id: tenant.id,
          user_id: admin.id,
          operation_size: updated.operationSize,
          custom_layout: updated.customLayout,
          favorites: updated.favorites,
          collapsed_sections: updated.collapsedSections,
          pinned_items: updated.pinnedItems,
          last_accessed_features: updated.lastAccessedFeatures,
        }], {
          onConflict: 'tenant_id,user_id',
        });

      if (error) throw error;
    },
    onMutate: async (updates) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.id] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<SidebarPreferences>(['sidebar-preferences', tenant?.id, admin?.id]);

      // Optimistically update
      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.id],
        (old) => ({
          ...(old || DEFAULT_PREFERENCES),
          ...updates,
        })
      );

      return { previous };
    },
    onError: (error: unknown, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ['sidebar-preferences', tenant?.id, admin?.id],
          context.previous
        );
      }
      logger.error('Failed to update sidebar preferences', error, { component: 'useSidebarPreferences' });
      toast.error('Failed to save preferences');
    },
    onSuccess: () => {
      toast.success('Preferences saved');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.id] });
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!tenant?.id || !admin?.id) throw new Error('Tenant and admin required');

      const current = preferences || DEFAULT_PREFERENCES;
      const newFavorites = current.favorites.includes(itemId)
        ? current.favorites.filter(id => id !== itemId)
        : [...current.favorites, itemId];

      await updatePreferencesMutation.mutateAsync({ favorites: newFavorites });
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.id] });
      const previous = queryClient.getQueryData<SidebarPreferences>(['sidebar-preferences', tenant?.id, admin?.id]);

      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.id],
        (old) => {
          const current = old || DEFAULT_PREFERENCES;
          const newFavorites = current.favorites.includes(itemId)
            ? current.favorites.filter(id => id !== itemId)
            : [...current.favorites, itemId];
          return { ...current, favorites: newFavorites };
        }
      );

      return { previous };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['sidebar-preferences', tenant?.id, admin?.id],
          context.previous
        );
      }
      logger.error('Failed to toggle favorite', error, { component: 'useSidebarPreferences' });
    },
  });

  // Toggle collapsed section mutation
  const toggleCollapsedSectionMutation = useMutation({
    mutationFn: async (sectionName: string) => {
      if (!tenant?.id || !admin?.id) throw new Error('Tenant and admin required');

      const current = preferences || DEFAULT_PREFERENCES;
      const newCollapsed = current.collapsedSections.includes(sectionName)
        ? current.collapsedSections.filter(name => name !== sectionName)
        : [...current.collapsedSections, sectionName];

      await updatePreferencesMutation.mutateAsync({ collapsedSections: newCollapsed });
    },
    onMutate: async (sectionName) => {
      await queryClient.cancelQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.id] });
      const previous = queryClient.getQueryData<SidebarPreferences>(['sidebar-preferences', tenant?.id, admin?.id]);

      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.id],
        (old) => {
          const current = old || DEFAULT_PREFERENCES;
          const newCollapsed = current.collapsedSections.includes(sectionName)
            ? current.collapsedSections.filter(name => name !== sectionName)
            : [...current.collapsedSections, sectionName];
          return { ...current, collapsedSections: newCollapsed };
        }
      );

      return { previous };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['sidebar-preferences', tenant?.id, admin?.id],
          context.previous
        );
      }
      logger.error('Failed to toggle collapsed section', error, { component: 'useSidebarPreferences' });
    },
  });

  // Track last accessed feature
  const trackFeatureAccess = (featureId: string) => {
    if (!tenant?.id || !admin?.id) return;

    const current = preferences || DEFAULT_PREFERENCES;
    const now = Date.now();
    const newLastAccessed = [
      { id: featureId, timestamp: now },
      ...current.lastAccessedFeatures.filter(f => f.id !== featureId),
    ].slice(0, 10); // Keep only last 10

    // Update optimistically without showing toast
    queryClient.setQueryData<SidebarPreferences>(
      ['sidebar-preferences', tenant?.id, admin?.id],
      (old) => ({
        ...(old || DEFAULT_PREFERENCES),
        lastAccessedFeatures: newLastAccessed,
      })
    );

    // Sync to database in background
    updatePreferencesMutation.mutate({ lastAccessedFeatures: newLastAccessed });
  };

  return {
    preferences: preferences || DEFAULT_PREFERENCES,
    isLoading,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    toggleFavorite: toggleFavoriteMutation.mutate,
    toggleCollapsedSection: toggleCollapsedSectionMutation.mutate,
    trackFeatureAccess,
  };
}

