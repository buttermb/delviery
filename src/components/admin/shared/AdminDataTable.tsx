import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminDataTableProps<T> {
    // Data
    data: T[];
    columns: ResponsiveColumn<T>[];
    keyExtractor?: (item: T) => string;

    // State
    isLoading?: boolean;
    isError?: boolean;
    onRetry?: () => void;

    // Card Header Configuration
    title?: string | React.ReactNode;
    description?: string;
    headerActions?: React.ReactNode;

    // Empty State
    emptyStateTitle?: string;
    emptyStateDescription?: string;
    emptyStateIcon?: React.ElementType;
    emptyStateAction?: {
        label: string;
        onClick: () => void;
        icon?: React.ElementType | React.ReactNode;
    };

    // Responsive / View Mode
    viewMode?: "list" | "grid";
    renderGridItem?: (item: T) => React.ReactNode;
    renderMobileItem?: (item: T) => React.ReactNode;
    onRowClick?: (item: T) => void;

    // Skeletons
    gridSkeletonCount?: number;
    listSkeletonCount?: number;

    // Styling
    className?: string;
}

export function AdminDataTable<T>({
    data,
    columns,
    keyExtractor = (item: T) => (item as Record<string, unknown>).id as string || Math.random().toString(),
    isLoading,
    isError,
    onRetry,
    title,
    description,
    headerActions,
    emptyStateTitle = "No records found",
    emptyStateDescription = "You have no records to display. Create one to get started.",
    emptyStateIcon,
    emptyStateAction,
    viewMode = "list",
    renderGridItem,
    renderMobileItem,
    onRowClick,
    gridSkeletonCount = 8,
    listSkeletonCount = 6,
    className,
}: AdminDataTableProps<T>) {
    const renderHeader = () => {
        if (!title && !description && !headerActions) return null;
        return (
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                    {title && <CardTitle>{title}</CardTitle>}
                    {description && <CardDescription>{description}</CardDescription>}
                </div>
                {headerActions && <div>{headerActions}</div>}
            </CardHeader>
        );
    };

    // Loading State
    if (isLoading) {
        return (
            <Card className={className}>
                {renderHeader()}
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                    {viewMode === "grid" && renderGridItem ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-0">
                            {[...Array(gridSkeletonCount)].map((_, i) => (
                                <div key={`skel-g-${i}`} className="border rounded-lg p-4 space-y-3 bg-card">
                                    <Skeleton className="h-32 w-full rounded" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <div className="flex justify-between mt-4">
                                        <Skeleton className="h-6 w-16" />
                                        <Skeleton className="h-6 w-20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-0 p-4 sm:p-0">
                            {[...Array(listSkeletonCount)].map((_, i) => (
                                <div key={`skel-l-${i}`} className="flex items-center gap-4 py-3 border-b last:border-b-0 border-border/40">
                                    <Skeleton className="h-5 w-5 rounded shrink-0" />
                                    <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                                    <div className="flex-1 space-y-1.5 py-1">
                                        <Skeleton className="h-4 w-48 max-w-[50%]" />
                                        <Skeleton className="h-3 w-24 max-w-[30%]" />
                                    </div>
                                    <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                                    <Skeleton className="h-4 w-16 shrink-0" />
                                    <Skeleton className="h-8 w-8 rounded shrink-0 sm:ml-4" />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Error State
    if (isError) {
        return (
            <Card className={className}>
                {renderHeader()}
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
                    <h3 className="text-lg font-semibold mb-1">Failed to load data</h3>
                    <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                        Something went wrong while fetching this information. Please check your connection and try again.
                    </p>
                    {onRetry && (
                        <Button variant="outline" onClick={onRetry} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Try Again
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            {renderHeader()}
            <CardContent className={cn("p-0 sm:p-6 sm:pt-0", { "pt-6": !title && !headerActions && !description })}>
                {data.length === 0 ? (
                    <div className="py-12 border rounded-md bg-muted/20 my-4 sm:my-0">
                        <EnhancedEmptyState
                            title={emptyStateTitle}
                            description={emptyStateDescription}
                            icon={emptyStateIcon as React.ReactNode}
                            primaryAction={emptyStateAction as any}
                        />
                    </div>
                ) : viewMode === "grid" && renderGridItem ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-0">
                        {data.map((item) => (
                            <div key={keyExtractor(item)}>
                                {renderGridItem(item)}
                            </div>
                        ))}
                    </div>
                ) : (
                    <ResponsiveTable
                        data={data}
                        columns={columns}
                        keyExtractor={keyExtractor}
                        mobileRenderer={renderMobileItem}
                        onRowClick={onRowClick}
                    />
                )}
            </CardContent>
        </Card>
    );
}
