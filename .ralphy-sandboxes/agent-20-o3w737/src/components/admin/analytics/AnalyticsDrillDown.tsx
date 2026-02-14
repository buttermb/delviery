/**
 * Analytics Drill-Down Panel
 *
 * A slide-out sheet that shows underlying records when a chart data point is clicked.
 * Includes breadcrumb trail for drill-down path and clickable rows to navigate
 * to entity detail pages via useEntityNavigation.
 */

import { Fragment } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';

import type { DrillDownContext, DrillDownRecord } from '@/hooks/useAnalyticsDrillDown';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface AnalyticsDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drillDown: DrillDownContext | null;
  breadcrumbTrail: Array<{ label: string; onClick?: () => void }>;
  onRecordClick: (record: DrillDownRecord) => void;
}

export function AnalyticsDrillDown({
  open,
  onOpenChange,
  drillDown,
  breadcrumbTrail,
  onRecordClick,
}: AnalyticsDrillDownProps) {
  if (!drillDown) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          {/* Breadcrumb trail */}
          <nav
            className="flex items-center gap-1 text-xs text-muted-foreground mb-1"
            aria-label="Drill-down breadcrumb"
          >
            {breadcrumbTrail.map((crumb, idx) => (
              <Fragment key={idx}>
                {idx > 0 && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                {crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    className="hover:text-foreground transition-colors truncate max-w-[120px]"
                    type="button"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground font-medium truncate max-w-[120px]">
                    {crumb.label}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>

          <SheetTitle>{drillDown.title}</SheetTitle>
          <SheetDescription>
            {drillDown.records.length} record{drillDown.records.length !== 1 ? 's' : ''} for{' '}
            <span className="font-medium text-foreground">{drillDown.filterLabel}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 -mx-6 px-6 h-[calc(100vh-160px)]">
          {drillDown.records.length > 0 ? (
            <div className="space-y-1">
              {drillDown.records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => onRecordClick(record)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors text-left group"
                  type="button"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{record.label}</p>
                    {record.sublabel && (
                      <p className="text-xs text-muted-foreground truncate">
                        {record.sublabel}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {record.value && (
                      <Badge variant="secondary" className="text-xs">
                        {record.value}
                      </Badge>
                    )}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No records found for this data point.
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
