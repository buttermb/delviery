import { create } from 'zustand';

interface BulkSelectionState {
  /** Whether bulk selection is currently active (any items selected) */
  isActive: boolean;
  /** Set the bulk selection active state */
  setActive: (active: boolean) => void;
}

/**
 * Store for coordinating bulk selection visibility across components.
 * Used primarily to hide/show the mobile bottom nav when bulk actions are active.
 */
export const useBulkSelectionStore = create<BulkSelectionState>((set) => ({
  isActive: false,
  setActive: (active) => set({ isActive: active }),
}));
