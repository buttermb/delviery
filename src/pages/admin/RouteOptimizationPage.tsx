/**
 * Route Optimization Page
 * Admin page for optimizing delivery routes
 */

import { RouteOptimizer } from '@/components/admin/routing/RouteOptimizer';

export default function RouteOptimizationPage() {
  return (
    <div className="container mx-auto p-6">
      <RouteOptimizer />
    </div>
  );
}
