/**
 * Sales Chart Widget - Placeholder for chart visualization
 */

import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp } from 'lucide-react';

export function SalesChartWidget() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Sales Performance (30 Days)
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-emerald-600 font-medium">+12%</span>
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
        <div className="text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Chart visualization</p>
          <p className="text-xs mt-1">Integration with chart library (Recharts/Chart.js)</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground mb-1">Flower</div>
          <div className="font-semibold">65%</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Concentrate</div>
          <div className="font-semibold">25%</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Edible</div>
          <div className="font-semibold">10%</div>
        </div>
      </div>
    </Card>
  );
}

