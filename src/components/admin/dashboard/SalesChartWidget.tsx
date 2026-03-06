/**
 * Sales Chart Widget - Coming soon placeholder
 */

import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function SalesChartWidget() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Sales Performance
        </h3>
      </div>

      <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
        <div className="text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Coming Soon</p>
          <p className="text-xs mt-1">Sales analytics will be available here once chart integration is complete.</p>
        </div>
      </div>
    </Card>
  );
}

