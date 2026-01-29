/**
 * Sidebar Context Provider
 *
 * Provides global sidebar state to all sidebar components.
 * Collapsed section state is persisted to localStorage per section
 * for instant load on page refresh, with database sync for cross-device persistence.
 */

import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useOperationSize } from '@/hooks/useOperationSize';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';
import { STORAGE_KEYS, safeStorage, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';
import type { OperationSize, SidebarPreferences, HotItem } from '@/types/sidebar';

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

interface SidebarContextType {
  operationSize: OperationSize;
  setOperationSize: (size: OperationSize) => void;
  detectedSize: OperationSize;
  isAutoDetected: boolean;
  resetToAuto: () => void;
  preferences: SidebarPreferences;
  updatePreferences: (prefs: Partial<SidebarPreferences>) => Promise<void>;
  favorites: string[];
  toggleFavorite: (itemId: string) => void;
  toggleCollapsedSection: (sectionName: string) => void;
  trackFeatureAccess: (featureId: string) => void;
  trackFeatureClick: (featureId: string) => void;
  /** Search query for filtering sidebar items */
  searchQuery: string;
  /** Update the search query */
  setSearchQuery: (query: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const {
    operationSize,
    setOperationSize,
    detectedSize,
    isAutoDetected,
    resetToAuto,
  } = useOperationSize();

  const {
    preferences,
    updatePreferences,
    toggleFavorite,
    toggleCollapsedSection: hookToggleCollapsedSection,
    trackFeatureAccess,
    isLoading: preferencesLoading,
  } = useSidebarPreferences();

  const { trackFeature } = useFeatureTracking();
  const trackFeatureClick = trackFeature;

  // Local state for collapsed sections - initialized from localStorage for instant load
  const [localCollapsedSections, setLocalCollapsedSections] = useState<string[]>(
    getCollapsedSectionsFromStorage
  );
  const isInitialSyncDone = useRef(false);

  // Sync local state with preferences when they load from database
  useEffect(() => {
    if (!preferencesLoading && preferences?.collapsedSections && !isInitialSyncDone.current) {
      // Only sync if database has data (non-empty array)
      if (preferences.collapsedSections.length > 0) {
        setLocalCollapsedSections(preferences.collapsedSections);
        saveCollapsedSectionsToStorage(preferences.collapsedSections);
      }
      isInitialSyncDone.current = true;
    }
  }, [preferencesLoading, preferences?.collapsedSections]);

  // Enhanced toggle function that persists to localStorage immediately
  // and also calls the hook's toggle for database sync
  const toggleCollapsedSection = useCallback((sectionName: string) => {
    setLocalCollapsedSections((current) => {
      const newCollapsed = current.includes(sectionName)
        ? current.filter((name) => name !== sectionName)
        : [...current, sectionName];

      // Persist to localStorage immediately for fast reload
      saveCollapsedSectionsToStorage(newCollapsed);

      return newCollapsed;
    });

    // Also trigger the hook's toggle for database persistence
    // This may be a no-op if user context is not ready, but that's ok
    // since we've already persisted to localStorage
    hookToggleCollapsedSection(sectionName);
  }, [hookToggleCollapsedSection]);

  // Search query state for filtering sidebar items
  const [searchQuery, setSearchQueryState] = useState('');
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  // Merge local collapsed sections with preferences for the context value
  const mergedPreferences: SidebarPreferences = {
    ...preferences,
    collapsedSections: localCollapsedSections,
  };

  const value: SidebarContextType = {
    operationSize,
    setOperationSize,
    detectedSize,
    isAutoDetected,
    resetToAuto,
    preferences: mergedPreferences,
    updatePreferences,
    favorites: Array.isArray(preferences?.favorites) ? preferences.favorites : [],
    toggleFavorite,
    toggleCollapsedSection,
    trackFeatureAccess,
    trackFeatureClick,
    searchQuery,
    setSearchQuery,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

