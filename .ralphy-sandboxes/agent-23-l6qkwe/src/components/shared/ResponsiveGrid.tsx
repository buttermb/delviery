import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EnhancedEmptyState, EnhancedEmptyStateProps } from "@/components/shared/EnhancedEmptyState";

interface ResponsiveGridProps<T> {
    data: T[];
    renderItem: (item: T) => React.ReactNode;
    keyExtractor: (item: T) => string;
    isLoading?: boolean;
    emptyState?: Omit<EnhancedEmptyStateProps, "className">;
    columns?: {
        default?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
        '2xl'?: number;
    };
    gap?: number;
    className?: string;
    loadingSkeletonCount?: number;
    loadingSkeleton?: React.ReactNode; // Optional custom skeleton
}

export function ResponsiveGrid<T>({
    data,
    renderItem,
    keyExtractor,
    isLoading,
    emptyState,
    columns = { default: 1, md: 2, lg: 3 },
    gap = 4,
    className,
    loadingSkeletonCount = 6,
    loadingSkeleton,
}: ResponsiveGridProps<T>) {
    // Construct grid class names based on props
    const gridClasses = cn(
        "grid",
        `gap-${gap}`,
        columns.default && `grid-cols-${columns.default}`,
        columns.sm && `sm:grid-cols-${columns.sm}`,
        columns.md && `md:grid-cols-${columns.md}`,
        columns.lg && `lg:grid-cols-${columns.lg}`,
        columns.xl && `xl:grid-cols-${columns.xl}`,
        columns['2xl'] && `2xl:grid-cols-${columns['2xl']}`,
        className
    );

    if (isLoading) {
        return (
            <div className={gridClasses}>
                {Array.from({ length: loadingSkeletonCount }).map((_, i) => (
                    <div key={i}>
                        {loadingSkeleton || <Skeleton className="h-64 w-full rounded-xl" />}
                    </div>
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
        <div className={gridClasses}>
            {data.map((item) => (
                <div key={keyExtractor(item)}>
                    {renderItem(item)}
                </div>
            ))}
        </div>
    );
}
