/**
 * Route Optimization Page
 * Optimize delivery routes using OSRM/GraphHopper algorithms
 */

import { RouteOptimizer } from '@/components/admin/routing/RouteOptimizer';
import { SEOHead } from '@/components/SEOHead';

export default function RouteOptimizationPage() {
  return (
    <>
      <SEOHead title="Route Optimization" />
      <div className="container mx-auto p-6">
        <RouteOptimizer />
      </div>
    </>
  );
}

