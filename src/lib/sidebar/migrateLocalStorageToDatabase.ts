import { logger } from '@/lib/logger';
/**
 * Storage Migration Utility
 * 
 * Migrates sidebar preferences from localStorage to database
 * Runs once per user on first load after migration is deployed
 */

import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import type { SidebarPreferences, OperationSize } from '@/types/sidebar';

interface MigrationResult {
  success: boolean;
  migrated: boolean;
  error?: string;
}

/**
 * Check if migration has already been completed for this user
 */
function hasMigrationCompleted(): boolean {
  return localStorage.getItem(STORAGE_KEYS.SIDEBAR_MIGRATION_COMPLETE) === 'true';
}

/**
 * Mark migration as completed
 */
function markMigrationComplete(): void {
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_MIGRATION_COMPLETE, 'true');
}

/**
 * Read old localStorage preferences
 */
function readLegacyPreferences(): Partial<SidebarPreferences> {
  try {
    const operationSize = localStorage.getItem(STORAGE_KEYS.SIDEBAR_OPERATION_SIZE) as OperationSize | null;
    const favorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.SIDEBAR_FAVORITES) || '[]');
    const collapsedSections = JSON.parse(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED_SECTIONS) || '[]');
    const pinnedItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.SIDEBAR_PINNED_ITEMS) || '[]');

    return {
      operationSize,
      customLayout: false,
      favorites: Array.isArray(favorites) ? favorites : [],
      collapsedSections: Array.isArray(collapsedSections) ? collapsedSections : [],
      pinnedItems: Array.isArray(pinnedItems) ? pinnedItems : [],
      lastAccessedFeatures: [],
    };
  } catch (error) {
    logger.error('Failed to read legacy preferences', error, { component: 'migrateLocalStorageToDatabase' });
    return {
      operationSize: null,
      customLayout: false,
      favorites: [],
      collapsedSections: [],
      pinnedItems: [],
      lastAccessedFeatures: [],
    };
  }
}

/**
 * Clear old localStorage entries
 */
function clearLegacyStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.SIDEBAR_OPERATION_SIZE);
  localStorage.removeItem(STORAGE_KEYS.SIDEBAR_FAVORITES);
  localStorage.removeItem(STORAGE_KEYS.SIDEBAR_COLLAPSED_SECTIONS);
  localStorage.removeItem(STORAGE_KEYS.SIDEBAR_PINNED_ITEMS);
}

/**
 * Migrate preferences to database
 */
export async function migrateLocalStorageToDatabase(
  tenantId: string,
  userId: string
): Promise<MigrationResult> {
  // Check if already migrated
  if (hasMigrationCompleted()) {
    return { success: true, migrated: false };
  }

  try {
    // Read legacy preferences
    const legacyPrefs = readLegacyPreferences();

    // Check if there's anything to migrate
    const hasData = 
      legacyPrefs.operationSize !== null ||
      (legacyPrefs.favorites && legacyPrefs.favorites.length > 0) ||
      (legacyPrefs.collapsedSections && legacyPrefs.collapsedSections.length > 0) ||
      (legacyPrefs.pinnedItems && legacyPrefs.pinnedItems.length > 0);

    if (!hasData) {
      // No data to migrate, just mark as complete
      markMigrationComplete();
      return { success: true, migrated: false };
    }

    // Migrate to database
    const { error } = await supabase
      .from('sidebar_preferences')
      .upsert([{
        tenant_id: tenantId,
        user_id: userId,
        operation_size: legacyPrefs.operationSize,
        custom_layout: legacyPrefs.customLayout,
        favorites: legacyPrefs.favorites,
        collapsed_sections: legacyPrefs.collapsedSections,
        pinned_items: legacyPrefs.pinnedItems,
        last_accessed_features: legacyPrefs.lastAccessedFeatures,
      }], {
        onConflict: 'tenant_id,user_id',
      });

    if (error) {
      logger.error('Failed to migrate preferences to database', error, { 
        component: 'migrateLocalStorageToDatabase',
        tenantId,
        userId,
      });
      return { 
        success: false, 
        migrated: false, 
        error: error.message 
      };
    }

    // Clear old storage and mark as complete
    clearLegacyStorage();
    markMigrationComplete();

    logger.info('Successfully migrated sidebar preferences to database', {
      component: 'migrateLocalStorageToDatabase',
      tenantId,
      userId,
      migratedData: legacyPrefs,
    });

    return { success: true, migrated: true };
  } catch (error) {
    logger.error('Migration failed with exception', error, { 
      component: 'migrateLocalStorageToDatabase' 
    });
    return { 
      success: false, 
      migrated: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Reset migration state (for testing/debugging)
 */
export function resetMigrationState(): void {
  localStorage.removeItem(STORAGE_KEYS.SIDEBAR_MIGRATION_COMPLETE);
  logger.info('Migration state reset', { component: 'migrateLocalStorageToDatabase' });
}
