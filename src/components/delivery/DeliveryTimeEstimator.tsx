/**
 * Task 345: Add delivery time estimation
 * Estimate delivery time based on distance, traffic, and historical data
 */

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DeliveryTimeEstimatorProps {
  distance?: number;
  zone?: string;
}

export function DeliveryTimeEstimator({ distance = 0, zone = 'Default' }: DeliveryTimeEstimatorProps) {
  // Simple estimation: 3 minutes per mile + 15 min base
  const estimatedMinutes = Math.ceil(distance * 3 + 15);
  const minTime = Math.max(20, estimatedMinutes - 10);
  const maxTime = estimatedMinutes + 15;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Estimated Delivery Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{minTime}-{maxTime} min</span>
          <Badge variant="outline">{zone}</Badge>
        </div>
        {distance > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Based on {distance.toFixed(1)} miles distance
          </p>
        )}
      </CardContent>
    </Card>
  );
}
