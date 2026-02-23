/**
 * Activity Logs Page
 * Unified activity feed with filterable timeline for tracking all system activities.
 * Enhanced with notification settings panel and clickable entity links.
 */

import { useActivityFeed } from '@/hooks/useActivityFeed';
import { ActivityFeedTimeline } from '@/components/admin/ActivityFeedTimeline';
import { ActivityFeedFilters } from '@/components/admin/ActivityFeedFilters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Settings2, Bell } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { BrowserNotificationToggle } from '@/components/admin/BrowserNotificationToggle';
import { SoundAlertToggle } from '@/components/admin/SoundAlertToggle';
import { DisabledTooltip } from '@/components/shared/DisabledTooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';

export function ActivityLogs() {
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold">Activity Feed</h1>
          <p className="text-muted-foreground">Track all system activities and user actions across your organization</p>
        </div>
        <EnhancedLoadingState variant="list" count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Activity Feed</h1>
          <p className="text-muted-foreground">
            Track all system activities and user actions across your organization
          </p>
        </div>
      </div>

      {/* Notification Settings */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Notification Settings
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alert Preferences</CardTitle>
              <CardDescription>
                Configure how you receive real-time notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <BrowserNotificationToggle />
              <SoundAlertToggle />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Activity Timeline */}
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
                Page {currentPage} of {totalPages} ({totalCount} total entries)
              </span>
              <div className="flex items-center gap-2">
                <DisabledTooltip disabled={!hasPrevPage && !isLoading} reason="No previous pages">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevPage}
                    disabled={!hasPrevPage || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                </DisabledTooltip>
                <DisabledTooltip disabled={!hasNextPage && !isLoading} reason="No more pages">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextPage}
                    disabled={!hasNextPage || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </DisabledTooltip>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
