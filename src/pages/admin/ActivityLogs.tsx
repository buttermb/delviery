/**
 * Activity Logs Page
 * Unified activity feed with filterable timeline for tracking all system activities.
 */

import { useActivityFeed } from '@/hooks/useActivityFeed';
import { ActivityFeedTimeline } from '@/components/admin/ActivityFeedTimeline';
import { ActivityFeedFilters } from '@/components/admin/ActivityFeedFilters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ActivityLogs() {
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
  } = useActivityFeed();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Feed</h1>
        <p className="text-muted-foreground">
          Track all system activities and user actions across your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Chronological feed of all platform activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActivityFeedFilters
            filters={filters}
            onFilterChange={updateFilters}
            onRefresh={() => refetch()}
            isLoading={isLoading}
            totalCount={totalCount}
          />

          <ActivityFeedTimeline
            entries={entries}
            isLoading={isLoading}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
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
