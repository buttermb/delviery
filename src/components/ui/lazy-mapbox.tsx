/**
 * Lazy-loaded Mapbox GL components and utilities
 * Loads Mapbox GL library only when map components are rendered
 */

import { lazy, ComponentType, Suspense, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MapPin from "lucide-react/dist/esm/icons/map-pin";

// Skeleton loader for Map components
export const MapSkeleton = ({ height = 500 }: { height?: number }) => (
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

// Lazy load Mapbox GL map components
export const LiveMap = withSuspense(
  lazy(() =>
    import('@/pages/admin/LiveMap').then((module) => ({
      default: module.default,
    }))
  )
);

export const OrderTrackingMap = withSuspense(
  lazy(() =>
    import('@/components/customer/OrderTrackingMap').then((module) => ({
      default: module.OrderTrackingMap,
    }))
  )
);

export const RouteView = withSuspense(
  lazy(() =>
    import('@/components/courier/RouteView').then((module) => ({
      default: module.RouteView,
    }))
  )
);

export const RouteOptimizer = withSuspense(
  lazy(() =>
    import('@/components/admin/routing/RouteOptimizer').then((module) => ({
      default: module.RouteOptimizer,
    }))
  )
);

export const RouteReplayMap = withSuspense(
  lazy(() =>
    import('@/components/admin/maps/RouteReplayMap').then((module) => ({
      default: module.RouteReplayMap,
    }))
  )
);

export const TerritoryMapView = withSuspense(
  lazy(() =>
    import('@/components/admin/TerritoryMapView').then((module) => ({
      default: module.TerritoryMapView,
    }))
  )
);

export const OrderMap = withSuspense(
  lazy(() =>
    import('@/components/admin/OrderMap').then((module) => ({
      default: module.OrderMap,
    }))
  )
);

export const LiveDeliveryMap = withSuspense(
  lazy(() =>
    import('@/components/admin/LiveDeliveryMap').then((module) => ({
      default: module.LiveDeliveryMap,
    }))
  )
);
