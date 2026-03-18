/**
 * useFeatureVisibility Hook
 * 
 * Manages which features are visible/hidden in the sidebar
 */

import { useSidebarPreferences } from './useSidebarPreferences';
import { getHiddenFeaturesByIntegrations } from '@/lib/sidebar/integrations';
import { applyLayoutPreset } from '@/lib/sidebar/layoutPresets';
import { ESSENTIAL_FEATURES } from '@/lib/sidebar/featureRegistry';

export function useFeatureVisibility() {
  const { preferences, updatePreferences } = useSidebarPreferences();

  const hiddenFeatures = preferences?.hiddenFeatures ?? [];
  const enabledIntegrations = preferences?.enabledIntegrations || ['mapbox', 'stripe'];
  const layoutPreset = preferences?.layoutPreset || 'default';

  // Get features hidden by disabled integrations
  const integrationHiddenFeatures = getHiddenFeaturesByIntegrations(enabledIntegrations);

  // Get features visible in current preset
  const presetVisibleFeatures = applyLayoutPreset(layoutPreset);

  /**
   * Check if a feature is visible
   */
  const isFeatureVisible = (featureId: string): boolean => {
    // Check if hidden by user
    if (hiddenFeatures.includes(featureId)) return false;

    // Check if hidden by disabled integration
    if (integrationHiddenFeatures.includes(featureId)) return false;

    // Check if allowed by preset
    if (presetVisibleFeatures !== 'all' && !presetVisibleFeatures.includes(featureId)) {
      return false;
    }

    return true;
  };

  /**
   * Hide a feature
   */
  const hideFeature = async (featureId: string) => {
    const updated = [...hiddenFeatures, featureId];
    await updatePreferences({ hiddenFeatures: updated });
  };

  /**
   * Show a feature
   */
  const showFeature = async (featureId: string) => {
    const updated = hiddenFeatures.filter(id => id !== featureId);
    await updatePreferences({ hiddenFeatures: updated });
  };

  /**
   * Toggle feature visibility
   */
  const toggleFeature = async (featureId: string) => {
    if (hiddenFeatures.includes(featureId)) {
      await showFeature(featureId);
    } else {
      await hideFeature(featureId);
    }
  };

  /**
   * Hide all features (except essential)
   */
  const hideAll = async (allFeatureIds: string[]) => {
    const toHide = allFeatureIds.filter(id => !ESSENTIAL_FEATURES.includes(id));
    await updatePreferences({ hiddenFeatures: toHide });
  };

  /**
   * Show all features
   */
  const showAll = async () => {
    await updatePreferences({ hiddenFeatures: [] });
  };

  /**
   * Reset to default visibility
   */
  const resetToDefault = async () => {
    await updatePreferences({
      hiddenFeatures: [],
      layoutPreset: 'default',
    });
  };

  /**
   * Get all visible features
   */
  const getVisibleFeatures = (allFeatureIds: string[]): string[] => {
    return allFeatureIds.filter(id => isFeatureVisible(id));
  };

  return {
    hiddenFeatures,
    isFeatureVisible,
    hideFeature,
    showFeature,
    toggleFeature,
    hideAll,
    showAll,
    resetToDefault,
    getVisibleFeatures,
  };
}
