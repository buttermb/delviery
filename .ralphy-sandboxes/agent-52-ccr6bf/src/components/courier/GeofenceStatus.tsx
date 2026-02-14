import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Navigation } from "lucide-react";
import { formatDistance, getGeofenceStatus, GEOFENCE_RADIUS_MILES } from "@/utils/geofenceHelper";

interface GeofenceStatusProps {
  distance: number | null;
  customerAddress: string;
}

export const GeofenceStatus = ({ distance, customerAddress }: GeofenceStatusProps) => {
  const status = getGeofenceStatus(distance);
  const progressPercentage = distance 
    ? Math.max(0, Math.min(100, ((GEOFENCE_RADIUS_MILES - distance) / GEOFENCE_RADIUS_MILES) * 100))
    : 0;

  return (
    <Card className="p-4 bg-gradient-to-br from-background to-muted/20">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Delivery Range</h3>
          </div>
          <div className={`flex items-center gap-1 ${status.statusColor} font-medium`}>
            {status.canComplete ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{status.statusIcon}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Distance to customer</span>
            <span className="font-mono font-semibold">
              {distance !== null ? formatDistance(distance) : "Unknown"}
            </span>
          </div>
          
          <Progress value={progressPercentage} className="h-2" />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Required: {formatDistance(GEOFENCE_RADIUS_MILES)}</span>
            <span className={status.statusColor}>{status.statusText}</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            📍 {customerAddress}
          </p>
        </div>

        {!status.canComplete && distance !== null && distance > GEOFENCE_RADIUS_MILES && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-500 mb-1">
              ⚠️ Not in delivery range
            </p>
            <p className="text-xs text-muted-foreground">
              Get within {formatDistance(GEOFENCE_RADIUS_MILES)} to complete this delivery.
              You need to move {formatDistance(distance - GEOFENCE_RADIUS_MILES)} closer.
            </p>
          </div>
        )}

        {status.canComplete && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
            <p className="font-medium text-green-600 dark:text-green-500">
              ✓ You can complete this delivery
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};