import { useState, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";

export interface TablePreferences {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    pageSize?: number;
    visibleColumns?: Record<string, boolean>;
    customFilters?: Record<string, unknown>;
    sorting?: Array<{ id: string; desc: boolean }>;
    columnVisibility?: Record<string, boolean>;
}

const defaultPreferences: TablePreferences = {
    pageSize: 10,
    visibleColumns: {},
    customFilters: {}
};

export function useTablePreferences(tableId: string, initialPreferences: TablePreferences = defaultPreferences) {
    const storageKey = `table-preferences-${tableId}`;

    // Extract complex expressions to separate variables for stable dependency tracking
    const visibleColumnsStr = JSON.stringify(initialPreferences.visibleColumns);
    const customFiltersStr = JSON.stringify(initialPreferences.customFilters);
    const sortingStr = JSON.stringify(initialPreferences.sorting);
    const columnVisibilityStr = JSON.stringify(initialPreferences.columnVisibility);

    // Stabilize initialPreferences to prevent re-renders from object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialPreferences is intentionally decomposed into individual fields above
    const stableInitialPreferences = useMemo(() => initialPreferences, [
        initialPreferences.sortBy,
        initialPreferences.sortOrder,
        initialPreferences.pageSize,
        visibleColumnsStr,
        customFiltersStr,
        sortingStr,
        columnVisibilityStr,
    ]);

    const loadPreferences = useCallback((): TablePreferences => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            logger.warn('Failed to load table preferences', { error: e });
        }
        return stableInitialPreferences;
    }, [storageKey, stableInitialPreferences]);

    const [preferences, setPreferences] = useState<TablePreferences>(loadPreferences);

    // Save preferences to localStorage
    const savePreferences = useCallback((newPreferences: Partial<TablePreferences>) => {
        setPreferences(prev => {
            const updated = { ...prev, ...newPreferences };
            try {
                localStorage.setItem(storageKey, JSON.stringify(updated));
            } catch (e) {
                logger.warn('Failed to save table preferences', { error: e });
            }
            return updated;
        });
    }, [storageKey]);

    // Helper to clear preferences
    const clearPreferences = useCallback(() => {
        localStorage.removeItem(storageKey);
        setPreferences(stableInitialPreferences);
    }, [storageKey, stableInitialPreferences]);

    return {
        preferences,
        savePreferences,
        clearPreferences
    };
}
