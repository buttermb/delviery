/**
 * useSectionManager Hook
 * 
 * Manages section ordering and custom sections
 */

import { useSidebarPreferences } from './useSidebarPreferences';
import type { CustomSection } from '@/types/sidebar';

export function useSectionManager() {
  const { preferences, updatePreferences } = useSidebarPreferences();

  const sectionOrder = preferences?.sectionOrder || [];
  const customSections = preferences?.customSections || [];

  /**
   * Reorder sections
   */
  const reorderSections = async (newOrder: string[]) => {
    await updatePreferences({ sectionOrder: newOrder });
  };

  /**
   * Create a new custom section
   */
  const createCustomSection = async (name: string, items: string[] = []) => {
    const newSection: CustomSection = {
      id: `custom-${Date.now()}`,
      name,
      items,
      order: customSections.length,
    };

    const updated = [...customSections, newSection];
    await updatePreferences({ customSections: updated });
  };

  /**
   * Delete a custom section
   */
  const deleteCustomSection = async (id: string) => {
    const updated = customSections.filter(s => s.id !== id);
    await updatePreferences({ customSections: updated });
  };

  /**
   * Rename a section
   */
  const renameSection = async (id: string, newName: string) => {
    const updated = customSections.map(s =>
      s.id === id ? { ...s, name: newName } : s
    );
    await updatePreferences({ customSections: updated });
  };

  /**
   * Add item to custom section
   */
  const addItemToSection = async (sectionId: string, itemId: string) => {
    const updated = customSections.map(s =>
      s.id === sectionId
        ? { ...s, items: [...s.items, itemId] }
        : s
    );
    await updatePreferences({ customSections: updated });
  };

  /**
   * Remove item from custom section
   */
  const removeItemFromSection = async (sectionId: string, itemId: string) => {
    const updated = customSections.map(s =>
      s.id === sectionId
        ? { ...s, items: s.items.filter(id => id !== itemId) }
        : s
    );
    await updatePreferences({ customSections: updated });
  };

  return {
    sectionOrder,
    customSections,
    reorderSections,
    createCustomSection,
    deleteCustomSection,
    renameSection,
    addItemToSection,
    removeItemFromSection,
  };
}
