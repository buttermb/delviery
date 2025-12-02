import { useState, useCallback } from "react";
import { logger } from "@/lib/logger";

export interface TablePreferences {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    pageSize?: number;
    visibleColumns?: Record<string, boolean>;
    customFilters?: Record<string, any>;
    sorting?: any[];
    columnVisibility?: Record<string, boolean>;
}

const defaultPreferences: TablePreferences = {
    pageSize: 10,
    visibleColumns: {},
    customFilters: {}
};

export function useTablePreferences(tableId: string, initialPreferences: TablePreferences = defaultPreferences) {
    const storageKey = `table-preferences-${tableId}`;

    const loadPreferences = useCallback((): TablePreferences => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            logger.warn('Failed to load table preferences', { error: e });
        }
        return initialPreferences;
    }, [storageKey, initialPreferences]);

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
        setPreferences(initialPreferences);
    }, [storageKey, initialPreferences]);

    return {
        preferences,
        savePreferences,
        clearPreferences
    };
}
