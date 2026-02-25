import React from 'react';
import { SearchInput } from "@/components/shared/SearchInput";
import { cn } from "@/lib/utils";

export interface AdminToolbarProps {
    // Search section (top left)
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
    hideSearch?: boolean;

    // Actions section (top right)
    actions?: React.ReactNode;

    // Filters section (bottom left)
    filters?: React.ReactNode;

    // View/Column options (bottom right)
    viewOptions?: React.ReactNode;

    className?: string;
}

export function AdminToolbar({
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Search...",
    hideSearch = false,
    filters,
    actions,
    viewOptions,
    className
}: AdminToolbarProps) {
    const hasBottomRow = Boolean(filters || viewOptions);

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {/* Top Row: Search & Primary Actions */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                {/* Search Bar */}
                <div className="relative w-full sm:max-w-md sm:flex-1">
                    {!hideSearch && (
                        <SearchInput
                            placeholder={searchPlaceholder}
                            defaultValue={searchQuery}
                            onSearch={onSearchChange}
                            className="w-full"
                        />
                    )}
                </div>

                {/* Action Buttons */}
                {actions && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                        {actions}
                    </div>
                )}
            </div>

            {/* Bottom Row: Filters & View Toggles */}
            {hasBottomRow && (
                <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {filters}
                    </div>

                    {viewOptions && (
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 ml-auto">
                            {viewOptions}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
