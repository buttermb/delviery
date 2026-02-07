import { useState, useCallback, useEffect } from 'react';

interface Column {
    id: string;
    label: string;
    defaultVisible?: boolean;
    alwaysVisible?: boolean;
}

interface UseColumnVisibilityOptions {
    columns: Column[];
    storageKey?: string;
}

interface UseColumnVisibilityReturn {
    visibleColumns: Set<string>;
    isColumnVisible: (columnId: string) => boolean;
    toggleColumn: (columnId: string) => void;
    showColumn: (columnId: string) => void;
    hideColumn: (columnId: string) => void;
    showAllColumns: () => void;
    resetToDefaults: () => void;
    getVisibleColumnList: () => Column[];
}

/**
 * Hook for managing table column visibility
 * 
 * @example
 * ```tsx
 * const columns = [
 *   { id: 'name', label: 'Name', alwaysVisible: true },
 *   { id: 'email', label: 'Email', defaultVisible: true },
 *   { id: 'phone', label: 'Phone', defaultVisible: false },
 *   { id: 'address', label: 'Address', defaultVisible: false },
 * ];
 * 
 * const { visibleColumns, toggleColumn, getVisibleColumnList } = useColumnVisibility({
 *   columns,
 *   storageKey: 'customers-table-columns',
 * });
 * 
 * return (
 *   <Table>
 *     <TableHeader>
 *       {getVisibleColumnList().map(col => <TableHead key={col.id}>{col.label}</TableHead>)}
 *     </TableHeader>
 *     ...
 *   </Table>
 * );
 * ```
 */
export function useColumnVisibility({
    columns,
    storageKey,
}: UseColumnVisibilityOptions): UseColumnVisibilityReturn {
    // Calculate default visible columns
    const getDefaultVisibleColumns = useCallback((): Set<string> => {
        const defaultVisible = new Set<string>();
        columns.forEach((col) => {
            if (col.alwaysVisible || col.defaultVisible !== false) {
                defaultVisible.add(col.id);
            }
        });
        return defaultVisible;
    }, [columns]);

    // Initialize state from localStorage or defaults
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        if (storageKey && typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored) as string[];
                    // Ensure always-visible columns are included
                    const columnSet = new Set(parsed);
                    columns.forEach((col) => {
                        if (col.alwaysVisible) {
                            columnSet.add(col.id);
                        }
                    });
                    // Remove columns that no longer exist
                    const validColumns = new Set<string>();
                    columnSet.forEach((id) => {
                        if (columns.some((col) => col.id === id)) {
                            validColumns.add(id);
                        }
                    });
                    return validColumns;
                }
            } catch {
                // Ignore errors, use defaults
            }
        }
        return getDefaultVisibleColumns();
    });

    // Persist to localStorage when visibility changes
    useEffect(() => {
        if (storageKey && typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(visibleColumns)));
            } catch {
                // Ignore storage errors
            }
        }
    }, [visibleColumns, storageKey]);

    const isColumnVisible = useCallback(
        (columnId: string) => visibleColumns.has(columnId),
        [visibleColumns]
    );

    const toggleColumn = useCallback((columnId: string) => {
        const column = columns.find((col) => col.id === columnId);
        if (column?.alwaysVisible) return; // Can't toggle always-visible columns

        setVisibleColumns((prev) => {
            const next = new Set(prev);
            if (next.has(columnId)) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }
            return next;
        });
    }, [columns]);

    const showColumn = useCallback((columnId: string) => {
        setVisibleColumns((prev) => new Set(prev).add(columnId));
    }, []);

    const hideColumn = useCallback((columnId: string) => {
        const column = columns.find((col) => col.id === columnId);
        if (column?.alwaysVisible) return;

        setVisibleColumns((prev) => {
            const next = new Set(prev);
            next.delete(columnId);
            return next;
        });
    }, [columns]);

    const showAllColumns = useCallback(() => {
        setVisibleColumns(new Set(columns.map((col) => col.id)));
    }, [columns]);

    const resetToDefaults = useCallback(() => {
        setVisibleColumns(getDefaultVisibleColumns());
        if (storageKey && typeof window !== 'undefined') {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // Ignore storage errors
            }
        }
    }, [getDefaultVisibleColumns, storageKey]);

    const getVisibleColumnList = useCallback((): Column[] => {
        return columns.filter((col) => visibleColumns.has(col.id));
    }, [columns, visibleColumns]);

    return {
        visibleColumns,
        isColumnVisible,
        toggleColumn,
        showColumn,
        hideColumn,
        showAllColumns,
        resetToDefaults,
        getVisibleColumnList,
    };
}
