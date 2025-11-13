/**
 * Sidebar Context Provider
 * 
 * Provides global sidebar state to all sidebar components
 */

import { createContext, useContext, ReactNode } from 'react';
import { useOperationSize } from '@/hooks/useOperationSize';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';
import type { OperationSize, SidebarPreferences, HotItem } from '@/types/sidebar';

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
    toggleCollapsedSection,
    trackFeatureAccess,
  } = useSidebarPreferences();

  const { trackFeatureClick } = useFeatureTracking();

  const value: SidebarContextType = {
    operationSize,
    setOperationSize,
    detectedSize,
    isAutoDetected,
    resetToAuto,
    preferences,
    updatePreferences,
    favorites: preferences.favorites,
    toggleFavorite,
    toggleCollapsedSection,
    trackFeatureAccess,
    trackFeatureClick,
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

