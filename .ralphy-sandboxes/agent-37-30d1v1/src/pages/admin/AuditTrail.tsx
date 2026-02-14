/**
 * Audit Trail Page
 * Displays a filterable, paginated audit log of all changes to critical tables.
 */

import { useAuditTrail } from '@/hooks/useAuditTrail';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { AuditLogFilters } from '@/components/admin/AuditLogFilters';
import { AuditLogTable } from '@/components/admin/AuditLogTable';

export default function AuditTrail() {
  const {
    entries,
    totalCount,
    isLoading,
    filters,
    updateFilters,
    refetch,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
  } = useAuditTrail();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Audit Trail</h1>
          <p className="text-muted-foreground">Complete history of system changes and user actions</p>
        </div>
        <EnhancedLoadingState variant="table" count={8} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Trail</h1>
        <p className="text-muted-foreground">Complete history of system changes and user actions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            Track changes to products, orders, team members, and tenant settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuditLogFilters
            filters={filters}
            onFilterChange={updateFilters}
            onRefresh={() => refetch()}
            isLoading={isLoading}
            totalCount={totalCount}
          />

          <AuditLogTable entries={entries} isLoading={isLoading} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({totalCount} total entries)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={!hasPrevPage || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={!hasNextPage || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
