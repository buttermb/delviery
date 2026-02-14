import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertCircle } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useCourier } from '@/contexts/CourierContext';

export function LocationTrackingStatus() {
  const { isOnline } = useCourier();
  const { currentLocation, error } = useLocationTracking(isOnline);

  if (!isOnline) return null;

  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${error ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              {error ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <MapPin className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">Location Tracking</p>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : currentLocation ? (
                <p className="text-sm text-muted-foreground">
                  Accuracy: {currentLocation.accuracy.toFixed(0)}m
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Initializing...</p>
              )}
            </div>
          </div>
          <Badge variant={error ? 'destructive' : 'default'}>
            {error ? 'Error' : 'Active'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
