import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, TrendingDown, Navigation } from "lucide-react";

interface Stop {
  id: string;
  clientName: string;
  address: string;
  orderValue: number;
  estimatedTime: string;
}

interface RouteOptimizationPreviewProps {
  runnerId: string;
  runnerName: string;
  stops: Stop[];
  totalDistance: string;
  totalTime: string;
  fuelSavings: string;
  onApplyRoute?: () => void;
}

export function RouteOptimizationPreview({
  runnerName,
  stops,
  totalDistance,
  totalTime,
  fuelSavings,
  onApplyRoute
}: RouteOptimizationPreviewProps) {
  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              Optimized Route - {runnerName}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {stops.length} stops planned
            </p>
          </div>
          <Button onClick={onApplyRoute} className="gap-2">
            <Navigation className="h-4 w-4" />
            Apply Route
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-4 w-4" />
              Distance
            </div>
            <div className="text-xl font-bold">{totalDistance}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Est. Time
            </div>
            <div className="text-xl font-bold">{totalTime}</div>
          </div>
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 text-sm text-success mb-1">
              <TrendingDown className="h-4 w-4" />
              Fuel Savings
            </div>
            <div className="text-xl font-bold text-success">{fuelSavings}</div>
          </div>
        </div>

        {/* Route Stops */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Route Sequence</h4>
          <div className="space-y-2">
            {stops.map((stop, index) => (
              <div
                key={stop.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate">{stop.clientName}</span>
                    <Badge variant="outline" className="text-xs">
                      ${stop.orderValue.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{stop.address}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {stop.estimatedTime}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimization Tips */}
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex gap-2">
            <div className="text-blue-600 text-sm">
              💡 <span className="font-medium">Optimization Tips:</span> Route avoids traffic hotspots and minimizes backtracking. Consider weather conditions for final adjustments.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
