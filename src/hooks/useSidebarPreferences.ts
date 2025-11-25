import { logger } from '@/lib/logger';
/**
 * useSidebarPreferences Hook
 * 
 * Manages user sidebar preferences with React Query and optimistic updates
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { SidebarPreferences } from '@/types/sidebar';
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
  hiddenFeatures: [],
  sectionOrder: [],
  customSections: [],
  enabledIntegrations: ['mapbox', 'stripe'],
  customMenuItems: [],
  layoutPreset: 'default',
  sidebarBehavior: {
    autoCollapse: true,
    iconOnly: false,
    showTooltips: true,
  },
  customPresets: [],
};

/**
 * Hook to get and update sidebar preferences
 */
export function useSidebarPreferences() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();


  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['sidebar-preferences', tenant?.id, admin?.userId],
    queryFn: async (): Promise<SidebarPreferences> => {
      if (!tenant?.id || !admin?.userId) return DEFAULT_PREFERENCES;

      const { data, error } = await (supabase as any)
        .from('sidebar_preferences')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('user_id', admin.userId)
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
        operationSize: (data as any).operation_size as SidebarPreferences['operationSize'],
        customLayout: (data as any).custom_layout || false,
        favorites: ((data as any).favorites as string[]) || [],
        collapsedSections: ((data as any).collapsed_sections as string[]) || [],
        pinnedItems: ((data as any).pinned_items as string[]) || [],
        lastAccessedFeatures: ((data as any).last_accessed_features as SidebarPreferences['lastAccessedFeatures']) || [],
        hiddenFeatures: ((data as any).hidden_features as string[]) || [],
        sectionOrder: ((data as any).section_order as string[]) || [],
        customSections: ((data as any).custom_sections as any[]) || [],
        enabledIntegrations: ((data as any).enabled_integrations as string[]) || ['mapbox', 'stripe'],
        customMenuItems: ((data as any).custom_menu_items as any[]) || [],
        layoutPreset: (data as any).layout_preset || 'default',
        sidebarBehavior: ((data as any).sidebar_behavior as any) || DEFAULT_PREFERENCES.sidebarBehavior,
        customPresets: ((data as any).custom_presets as any[]) || [],
      };
    },
    enabled: !!tenant?.id && !!admin?.userId,
    staleTime: 1000, // Reduce cache time for faster updates
    refetchOnMount: 'always', // Always fetch fresh data on mount
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<SidebarPreferences>) => {
      if (!tenant?.id || !admin?.userId) throw new Error('Tenant and admin required');

      const current = preferences || DEFAULT_PREFERENCES;
      const updated: SidebarPreferences = {
        ...current,
        ...updates,
      };

      const { data, error } = await (supabase as any)
        .from('sidebar_preferences')
        .upsert([{
          tenant_id: tenant.id,
          user_id: admin.userId,
          operation_size: updated.operationSize,
          custom_layout: updated.customLayout,
          favorites: updated.favorites,
          collapsed_sections: updated.collapsedSections,
          pinned_items: updated.pinnedItems,
          last_accessed_features: updated.lastAccessedFeatures,
          hidden_features: updated.hiddenFeatures,
          section_order: updated.sectionOrder,
          custom_sections: updated.customSections,
          enabled_integrations: updated.enabledIntegrations,
          custom_menu_items: updated.customMenuItems,
          layout_preset: updated.layoutPreset,
          sidebar_behavior: updated.sidebarBehavior,
          custom_presets: updated.customPresets,
        }], {
          onConflict: 'tenant_id,user_id',
        });

      if (error) throw error;

      // Return the updated data for later use
      return updated;
    },
    onSuccess: async (updatedData) => {
      // Directly set the cache to the confirmed data
      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.userId],
        updatedData
      );

      // Wait a bit longer for database consistency
      await new Promise(resolve => setTimeout(resolve, 300));

      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ['sidebar-config'] });

      toast.success('Preferences saved');
    },
    onError: (error: unknown) => {
      logger.error('Failed to update sidebar preferences', error, { component: 'useSidebarPreferences' });
      toast.error('Failed to save preferences');

      // Refetch to get correct state
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.userId] });
    },
  });

  const updatePreferences = async (updates: Partial<SidebarPreferences>): Promise<void> => {
    await updatePreferencesMutation.mutateAsync(updates);
  };

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!tenant?.id || !admin?.userId) throw new Error('Tenant and admin required');

      const current = preferences || DEFAULT_PREFERENCES;
      const newFavorites = current.favorites.includes(itemId)
        ? current.favorites.filter(id => id !== itemId)
        : [...current.favorites, itemId];

      await updatePreferencesMutation.mutateAsync({ favorites: newFavorites });
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.userId] });
      const previous = queryClient.getQueryData<SidebarPreferences>(['sidebar-preferences', tenant?.id, admin?.userId]);

      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.userId],
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
          ['sidebar-preferences', tenant?.id, admin?.userId],
          context.previous
        );
      }
      logger.error('Failed to toggle favorite', error, { component: 'useSidebarPreferences' });
    },
  });

  // Toggle collapsed section mutation
  const toggleCollapsedSectionMutation = useMutation({
    mutationFn: async (sectionName: string) => {
      if (!tenant?.id || !admin?.userId) throw new Error('Tenant and admin required');

      const current = preferences || DEFAULT_PREFERENCES;
      const newCollapsed = current.collapsedSections.includes(sectionName)
        ? current.collapsedSections.filter(name => name !== sectionName)
        : [...current.collapsedSections, sectionName];

      await updatePreferencesMutation.mutateAsync({ collapsedSections: newCollapsed });
    },
    onMutate: async (sectionName) => {
      await queryClient.cancelQueries({ queryKey: ['sidebar-preferences', tenant?.id, admin?.userId] });
      const previous = queryClient.getQueryData<SidebarPreferences>(['sidebar-preferences', tenant?.id, admin?.userId]);

      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.userId],
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
          ['sidebar-preferences', tenant?.id, admin?.userId],
          context.previous
        );
      }
      logger.error('Failed to toggle collapsed section', error, { component: 'useSidebarPreferences' });
    },
  });

  // Track last accessed feature
  const trackFeatureAccess = (featureId: string) => {
    if (!tenant?.id || !admin?.userId) return;

    const current = preferences || DEFAULT_PREFERENCES;
    const now = Date.now();
    const newLastAccessed = [
      { id: featureId, timestamp: now },
      ...current.lastAccessedFeatures.filter(f => f.id !== featureId),
    ].slice(0, 10); // Keep only last 10

    // Update optimistically without showing toast
    queryClient.setQueryData<SidebarPreferences>(
      ['sidebar-preferences', tenant?.id, admin?.userId],
      (old) => ({
        ...(old || DEFAULT_PREFERENCES),
        lastAccessedFeatures: newLastAccessed,
      })
    );

    // Sync to database in background
    updatePreferencesMutation.mutate({ lastAccessedFeatures: newLastAccessed });
  };

  // Loading guard
  if (!admin?.userId) {
    return {
      preferences: DEFAULT_PREFERENCES,
      isLoading: true,
      updatePreferences: async () => { },
      toggleFavorite: () => { },
      toggleCollapsedSection: () => { },
      trackFeatureAccess: () => { },
    };
  }

  return {
    preferences: preferences || DEFAULT_PREFERENCES,
    isLoading: isLoading || !admin?.userId,
    updatePreferences,
    toggleFavorite: toggleFavoriteMutation.mutate,
    toggleCollapsedSection: toggleCollapsedSectionMutation.mutate,
    trackFeatureAccess,
  };
}

