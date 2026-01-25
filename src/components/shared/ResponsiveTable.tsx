import React, { useMemo, memo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EnhancedEmptyState, EnhancedEmptyStateProps } from "@/components/shared/EnhancedEmptyState";
import { VirtualizedTable } from "@/components/shared/VirtualizedTable";

export interface ResponsiveColumn<T> {
    header: string | React.ReactNode;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode;
    className?: string;
    width?: number;
}

interface ResponsiveTableProps<T> {
    data: T[];
    columns: ResponsiveColumn<T>[];
    keyExtractor: (item: T) => string;
    isLoading?: boolean;
    emptyState?: Omit<EnhancedEmptyStateProps, "className">;
    mobileRenderer?: (item: T) => React.ReactNode;
    onRowClick?: (item: T) => void;
    /** Per-row className function for dynamic styling (e.g., highlight animations) */
    rowClassName?: (item: T) => string | undefined;
    className?: string;
    /** Enable virtualization for large datasets (auto-enabled when data > virtualizeThreshold) */
    virtualize?: boolean;
    /** Number of rows above which virtualization auto-activates (default: 100) */
    virtualizeThreshold?: number;
    /** Height of the virtualized container in pixels (default: 600) */
    virtualizeHeight?: number;
    /** Height of each row in the virtualized table (default: 48) */
    virtualizeRowHeight?: number;
}

/** Memoized table row to prevent re-renders when parent updates */
const MemoizedTableRow = memo(function MemoizedTableRow<T>({
    item,
    columns,
    onRowClick,
    itemKey,
    rowClassName,
}: {
    item: T;
    columns: ResponsiveColumn<T>[];
    onRowClick?: (item: T) => void;
    itemKey: string;
    rowClassName?: string;
}) {
    return (
        <TableRow
            onClick={() => onRowClick && onRowClick(item)}
            className={cn(
                onRowClick && "cursor-pointer hover:bg-muted/50 transition-colors",
                rowClassName
            )}
        >
            {columns.map((col, index) => (
                <TableCell key={index} className={col.className}>
                    {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                            ? (item[col.accessorKey] as React.ReactNode)
                            : null}
                </TableCell>
            ))}
        </TableRow>
    );
}) as <T>(props: {
    item: T;
    columns: ResponsiveColumn<T>[];
    onRowClick?: (item: T) => void;
    itemKey: string;
    rowClassName?: string;
}) => React.ReactElement;

export function ResponsiveTable<T>({
    data,
    columns,
    keyExtractor,
    isLoading,
    emptyState,
    mobileRenderer,
    onRowClick,
    rowClassName,
    className,
    virtualize,
    virtualizeThreshold = 100,
    virtualizeHeight = 600,
    virtualizeRowHeight = 48,
}: ResponsiveTableProps<T>) {
    // Determine if virtualization should be used (auto-enable for large datasets)
    const shouldVirtualize = virtualize ?? (data.length > virtualizeThreshold);

    // Convert ResponsiveColumn format to VirtualizedTable column format
    const virtualizedColumns = useMemo(() => {
        return columns.map((col, index) => ({
            id: String(index),
            header: typeof col.header === 'string' ? col.header : '',
            accessorKey: col.accessorKey as string | undefined,
            cell: col.cell
                ? (row: { original: T; index: number }) => col.cell!(row.original)
                : undefined,
            width: col.width,
            className: col.className,
        }));
    }, [columns]);

    // Stable onRowClick adapter for VirtualizedTable
    const handleVirtualRowClick = useMemo(() => {
        if (!onRowClick) return undefined;
        return (row: T) => onRowClick(row);
    }, [onRowClick]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (data.length === 0 && emptyState) {
        return (
            <EnhancedEmptyState
                {...emptyState}
            />
        );
    }

    return (
        <div className={cn("w-full", className)}>
            {/* Mobile View (Card List) - Visible on small screens if renderer provided */}
            {mobileRenderer && (
                <div className="block sm:hidden space-y-4">
                    {data.map((item) => (
                        <div
                            key={keyExtractor(item)}
                            onClick={() => onRowClick && onRowClick(item)}
                            className={cn(
                                "bg-card text-card-foreground rounded-lg border shadow-sm p-4",
                                onRowClick && "cursor-pointer active:scale-[0.98] transition-transform"
                            )}
                        >
                            {mobileRenderer(item)}
                        </div>
                    ))}
                </div>
            )}

            {/* Desktop View - Virtualized for large datasets, standard table for small */}
            <div className={cn(mobileRenderer ? "hidden sm:block" : "block")}>
                {shouldVirtualize ? (
                    <VirtualizedTable
                        columns={virtualizedColumns}
                        data={data}
                        height={virtualizeHeight}
                        rowHeight={virtualizeRowHeight}
                        onRowClick={handleVirtualRowClick ? (row: T) => handleVirtualRowClick(row) : undefined}
                        getRowId={(row: T, index: number) => keyExtractor(row)}
                    />
                ) : (
                    <div className="rounded-md border dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columns.map((col, index) => (
                                        <TableHead key={index} className={col.className}>
                                            {col.header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((item) => (
                                    <MemoizedTableRow
                                        key={keyExtractor(item)}
                                        item={item}
                                        columns={columns}
                                        onRowClick={onRowClick}
                                        itemKey={keyExtractor(item)}
                                        rowClassName={rowClassName?.(item)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}
