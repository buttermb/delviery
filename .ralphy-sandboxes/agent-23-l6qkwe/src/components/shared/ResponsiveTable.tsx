import React, { useMemo, memo, useCallback } from "react";
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
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";

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

interface KeyboardRowProps {
    tabIndex: number;
    "aria-rowindex": number;
    onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => void;
    onFocus: () => void;
    ref: (el: HTMLTableRowElement | null) => void;
}

/** Memoized table row to prevent re-renders when parent updates */
const MemoizedTableRow = memo(function MemoizedTableRow<T>({
    item,
    columns,
    onRowClick,
    itemKey: _itemKey,
    rowClassName,
    keyboardProps,
}: {
    item: T;
    columns: ResponsiveColumn<T>[];
    onRowClick?: (item: T) => void;
    itemKey?: string;
    rowClassName?: string;
    keyboardProps?: KeyboardRowProps;
}) {
    return (
        <TableRow
            ref={keyboardProps?.ref}
            tabIndex={keyboardProps?.tabIndex}
            aria-rowindex={keyboardProps?.["aria-rowindex"]}
            onKeyDown={keyboardProps?.onKeyDown}
            onFocus={keyboardProps?.onFocus}
            onClick={() => onRowClick && onRowClick(item)}
            className={cn(
                onRowClick && "cursor-pointer hover:bg-muted/50 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
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
    itemKey?: string;
    rowClassName?: string;
    keyboardProps?: KeyboardRowProps;
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

    const handleActivate = useCallback(
        (index: number) => {
            if (onRowClick && data[index]) {
                onRowClick(data[index]);
            }
        },
        [onRowClick, data]
    );

    const { tableProps, getRowProps } = useTableKeyboardNav({
        rowCount: data.length,
        onActivate: onRowClick ? handleActivate : undefined,
        enabled: !shouldVirtualize,
    });

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
    const handleVirtualRowClick = useCallback((row: T) => {
        onRowClick?.(row);
    }, [onRowClick]);

    if (isLoading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col, index) => (
                                <TableHead key={index} className={col.className}>
                                    <Skeleton className="h-4 w-20" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 6 }).map((_, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {columns.map((col, colIndex) => (
                                    <TableCell key={colIndex} className={col.className}>
                                        <Skeleton className={cn("h-4", colIndex === 0 ? "w-3/4" : "w-full")} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
                        onRowClick={onRowClick ? handleVirtualRowClick : undefined}
                        getRowId={(row: T, _index: number) => keyExtractor(row)}
                    />
                ) : (
                    <div className="rounded-md border dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
                        <Table containerClassName="max-h-[600px]" {...tableProps}>
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
                                {data.map((item, index) => (
                                    <MemoizedTableRow
                                        key={keyExtractor(item)}
                                        item={item}
                                        columns={columns}
                                        onRowClick={onRowClick}
                                        itemKey={keyExtractor(item)}
                                        rowClassName={rowClassName?.(item)}
                                        keyboardProps={getRowProps(index)}
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
