import React from "react";
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
import { LucideIcon } from "lucide-react";

export interface ResponsiveColumn<T> {
    header: string | React.ReactNode;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode;
    className?: string;
}

interface ResponsiveTableProps<T> {
    data: T[];
    columns: ResponsiveColumn<T>[];
    keyExtractor: (item: T) => string;
    isLoading?: boolean;
    emptyState?: Omit<EnhancedEmptyStateProps, "className">;
    mobileRenderer?: (item: T) => React.ReactNode;
    onRowClick?: (item: T) => void;
    className?: string;
}

export function ResponsiveTable<T>({
    data,
    columns,
    keyExtractor,
    isLoading,
    emptyState,
    mobileRenderer,
    onRowClick,
    className,
}: ResponsiveTableProps<T>) {
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

            {/* Desktop View (Table) - Hidden on small screens if renderer provided, otherwise always visible */}
            <div className={cn("rounded-md border", mobileRenderer ? "hidden sm:block" : "block")}>
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
                            <TableRow
                                key={keyExtractor(item)}
                                onClick={() => onRowClick && onRowClick(item)}
                                className={cn(
                                    onRowClick && "cursor-pointer hover:bg-muted/50 transition-colors"
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
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
