import { logger } from '@/lib/logger';
/**
 * useSidebarPreferences Hook
 *
 * Manages user sidebar preferences with React Query and optimistic updates.
 * Collapsed sections are persisted to both localStorage (for fast initial load)
 * and the database (for cross-device sync).
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { SidebarPreferences } from '@/types/sidebar';
import { toast } from 'sonner';
import { STORAGE_KEYS, safeStorage, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';

/**
 * Get collapsed sections from localStorage
 * Falls back to empty array if not found or invalid
 */
function getCollapsedSectionsFromStorage(): string[] {
  const stored = safeStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED_SECTIONS);
  return safeJsonParse<string[]>(stored, []);
}

/**
 * Save collapsed sections to localStorage
 */
function saveCollapsedSectionsToStorage(sections: string[]): void {
  const json = safeJsonStringify(sections);
  if (json) {
    safeStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED_SECTIONS, json);
  }
}

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
  enabledIntegrations: ['mapbox', 'stripe'], // Ensure stripe is default
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


  // Get initial collapsed sections from localStorage for fast initial render
  const localStorageCollapsedSections = useRef<string[]>(getCollapsedSectionsFromStorage());

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['sidebar-preferences', tenant?.id, admin?.userId],
    queryFn: async (): Promise<SidebarPreferences> => {
      if (!tenant?.id) {
        // Return defaults with localStorage collapsed sections for fast initial render
        return {
          ...DEFAULT_PREFERENCES,
          collapsedSections: localStorageCollapsedSections.current,
        };
      }

      // Get auth user ID with defensive fallback
      let userId = admin?.userId;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }

      if (!userId) {
        return {
          ...DEFAULT_PREFERENCES,
          collapsedSections: localStorageCollapsedSections.current,
        };
      }

      const { data, error } = await (supabase as any)
        .from('sidebar_preferences')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch sidebar preferences', error, { component: 'useSidebarPreferences' });
        // Fallback to localStorage collapsed sections on error
        return {
          ...DEFAULT_PREFERENCES,
          collapsedSections: localStorageCollapsedSections.current,
        };
      }

      if (!data) {
        // No database record, use localStorage collapsed sections
        return {
          ...DEFAULT_PREFERENCES,
          collapsedSections: localStorageCollapsedSections.current,
        };
      }

      // Parse JSONB fields with safe defaults
      const dbCollapsedSections = ((data as any).collapsed_sections as string[]) || [];

      // Sync database collapsed sections to localStorage for future fast loads
      saveCollapsedSectionsToStorage(dbCollapsedSections);

      return {
        operationSize: (data as any).operation_size as SidebarPreferences['operationSize'],
        customLayout: (data as any).custom_layout || false,
        favorites: ((data as any).favorites as string[]) || [],
        collapsedSections: dbCollapsedSections,
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
    enabled: !!tenant?.id,
    staleTime: 1000, // Reduce cache time for faster updates
    refetchOnMount: 'always', // Always fetch fresh data on mount
    // Use localStorage collapsed sections as placeholder data for instant render
    placeholderData: {
      ...DEFAULT_PREFERENCES,
      collapsedSections: localStorageCollapsedSections.current,
    },
  });

  // Auto-patch missing integrations for existing users (run only once per session)
  const hasPatchedRef = useRef(false);
  useEffect(() => {
    if (preferences && !isLoading && tenant?.id && admin?.userId && !hasPatchedRef.current) {
      const currentIntegrations = preferences.enabledIntegrations || [];
      const missingDefaults = ['stripe', 'mapbox'].filter(id => !currentIntegrations.includes(id));

      if (missingDefaults.length > 0) {
        hasPatchedRef.current = true;
        logger.info('Auto-patching missing default integrations', { missing: missingDefaults, component: 'useSidebarPreferences' });
        updatePreferencesMutation.mutate({
          enabledIntegrations: [...currentIntegrations, ...missingDefaults]
        });
      } else {
        hasPatchedRef.current = true; // Mark as checked even if no patch needed
      }
    }
  }, [preferences, isLoading, tenant?.id, admin?.userId]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<SidebarPreferences>) => {
      if (!tenant?.id) throw new Error('Tenant required');

      // Get auth user ID with defensive fallback
      let userId = admin?.userId;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }

      if (!userId) throw new Error('User ID required');

      const current = preferences || DEFAULT_PREFERENCES;
      const updated: SidebarPreferences = {
        ...current,
        ...updates,
      };

      const { data, error } = await (supabase as any)
        .from('sidebar_preferences')
        .upsert([{
          tenant_id: tenant.id,
          user_id: userId,
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

      // Note: Toast removed - was showing on every auto-save and background update
      // Toast should only be shown for explicit user actions in the calling component
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

      // Calculate new collapsed sections
      const current = previous || DEFAULT_PREFERENCES;
      const newCollapsed = current.collapsedSections.includes(sectionName)
        ? current.collapsedSections.filter(name => name !== sectionName)
        : [...current.collapsedSections, sectionName];

      // Persist to localStorage immediately for fast future loads
      saveCollapsedSectionsToStorage(newCollapsed);

      queryClient.setQueryData<SidebarPreferences>(
        ['sidebar-preferences', tenant?.id, admin?.userId],
        (old) => {
          const curr = old || DEFAULT_PREFERENCES;
          const collapsed = curr.collapsedSections.includes(sectionName)
            ? curr.collapsedSections.filter(name => name !== sectionName)
            : [...curr.collapsedSections, sectionName];
          return { ...curr, collapsedSections: collapsed };
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
        // Restore localStorage to previous state on error
        saveCollapsedSectionsToStorage(context.previous.collapsedSections);
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

