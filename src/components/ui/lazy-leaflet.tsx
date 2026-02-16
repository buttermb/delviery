/**
 * Lazy-loaded Leaflet components and utilities
 * Loads Leaflet library only when map components are rendered
 */

import { lazy, ComponentType, Suspense, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MapPin from "lucide-react/dist/esm/icons/map-pin";

// Skeleton loader for Map components
export const MapSkeleton = ({ height = 400 }: { height?: number }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Loading Map...
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Skeleton className="w-full rounded-lg" style={{ height: `${height}px` }} />
    </CardContent>
  </Card>
);

// Higher-order component to wrap lazy components with Suspense
function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  fallback: ReactNode = <MapSkeleton />
) {
  return (props: P) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

// Lazy load Leaflet map widgets
export const LeafletMapWidget = withSuspense(
  lazy(() =>
    import('@/components/admin/dashboard/LeafletMapWidget').then((module) => ({
      default: module.LeafletMapWidget,
    }))
  )
);

export const DeliveryZoneMapPreview = withSuspense(
  lazy(() =>
    import('@/components/admin/storefront/DeliveryZoneMapPreview').then((module) => ({
      default: module.DeliveryZoneMapPreview,
    }))
  )
);

// Type definitions for lazy-loaded components
export interface LeafletMapWidgetProps {
  className?: string;
  height?: number;
}

export interface DeliveryZoneMapPreviewProps {
  className?: string;
  zones?: unknown[];
}
