/**
 * Advanced Inventory Management Dashboard
 * Overview of all inventory locations, packages, and transfers
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Package, 
  Warehouse, 
  Truck, 
  MapPin, 
  TrendingUp, 
  AlertTriangle,
  Plus,
  Scan,
  Printer,
  ArrowRightLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface InventorySummary {
  total_quantity_lbs: number;
  total_value: number;
  in_stock_lbs: number;
  in_transit_lbs: number;
  at_risk_lbs: number;
  location_count: number;
  package_count: number;
  batch_count: number;
}

interface LocationInventory {
  id: string;
  location_name: string;
  location_type: string;
  capacity_lbs: number | null;
  current_stock_lbs: number;
  package_count: number;
  batch_count: number;
  total_value: number;
}

export default function InventoryDashboard() {
  const { account, loading: accountLoading } = useAccount();

  // Fetch inventory summary
  const { data: summary, isLoading: summaryLoading } = useQuery<InventorySummary>({
    queryKey: ['inventory-summary', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      // Get packages by status
      const { data: packages } = await supabase
        .from('inventory_packages')
        .select('quantity_lbs, status, product_id, products(wholesale_price)')
        .eq('account_id', account.id);

      const totalQuantity = packages?.reduce((sum, p) => sum + (p.quantity_lbs || 0), 0) || 0;
      const inStock = packages?.filter(p => p.status === 'available').reduce((sum, p) => sum + (p.quantity_lbs || 0), 0) || 0;
      const inTransit = packages?.filter(p => p.status === 'in_transit').reduce((sum, p) => sum + (p.quantity_lbs || 0), 0) || 0;
      const atRisk = packages?.filter(p => ['damaged', 'expired'].includes(p.status || '')).reduce((sum, p) => sum + (p.quantity_lbs || 0), 0) || 0;
      
      const totalValue = packages?.reduce((sum, p) => {
        const price = (p.products as any)?.wholesale_price || 0;
        return sum + ((p.quantity_lbs || 0) * price);
      }, 0) || 0;

      // Get counts
      const { count: locationCount } = await supabase
        .from('inventory_locations')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id);

      const { count: packageCount } = await supabase
        .from('inventory_packages')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id);

      const { count: batchCount } = await supabase
        .from('inventory_batches')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id);

      return {
        total_quantity_lbs: totalQuantity,
        total_value: totalValue,
        in_stock_lbs: inStock,
        in_transit_lbs: inTransit,
        at_risk_lbs: atRisk,
        location_count: locationCount || 0,
        package_count: packageCount || 0,
        batch_count: batchCount || 0,
      };
    },
    enabled: !!account?.id && !accountLoading,
  });

  // Fetch locations with inventory
  const { data: locations, isLoading: locationsLoading } = useQuery<LocationInventory[]>({
    queryKey: ['location-inventory', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data: locations } = await supabase
        .from('inventory_locations')
        .select('id, location_name, location_type, capacity_lbs, current_stock_lbs')
        .eq('account_id', account.id)
        .eq('status', 'active');

      if (!locations) return [];

      // Get package and batch counts per location
      const locationsWithCounts = await Promise.all(
        locations.map(async (loc) => {
          const { count: packageCount } = await supabase
            .from('inventory_packages')
            .select('*', { count: 'exact', head: true })
            .eq('current_location_id', loc.id);

          const { data: packages } = await supabase
            .from('inventory_packages')
            .select('quantity_lbs, product_id, products(wholesale_price)')
            .eq('current_location_id', loc.id);

          const totalValue = packages?.reduce((sum, p) => {
            const price = (p.products as any)?.wholesale_price || 0;
            return sum + ((p.quantity_lbs || 0) * price);
          }, 0) || 0;

          const { count: batchCount } = await supabase
            .from('inventory_packages')
            .select('batch_id', { count: 'exact', head: true })
            .eq('current_location_id', loc.id);

          return {
            ...loc,
            package_count: packageCount || 0,
            batch_count: batchCount || 0,
            total_value: totalValue,
          };
        })
      );

      return locationsWithCounts;
    },
    enabled: !!account?.id && !accountLoading,
  });

  // Get active transfers
  const { data: activeTransfers } = useQuery({
    queryKey: ['active-transfers', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data } = await supabase
        .from('inventory_transfers_enhanced')
        .select(`
          *,
          from_location:inventory_locations!inventory_transfers_enhanced_from_location_id_fkey(location_name),
          to_location:inventory_locations!inventory_transfers_enhanced_to_location_id_fkey(location_name)
        `)
        .eq('account_id', account.id)
        .in('status', ['pending', 'approved', 'in_progress', 'in_transit'])
        .order('scheduled_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!account?.id && !accountLoading,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatWeight = (lbs: number) => {
    return `${lbs.toFixed(1)} lbs`;
  };

  const getCapacityPercentage = (current: number, capacity: number | null) => {
    if (!capacity || capacity === 0) return 0;
    return Math.min(100, (current / capacity) * 100);
  };

  if (accountLoading || !account) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {accountLoading ? 'Loading account...' : 'No account found. Please set up your account first.'}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">
            Track inventory across all locations
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Button>
          <Button variant="outline">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Create Transfer
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div>Loading summary...</div>
      ) : summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatWeight(summary.total_quantity_lbs)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(summary.total_value)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Stock</CardTitle>
              <Warehouse className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatWeight(summary.in_stock_lbs)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available for sale
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Truck className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatWeight(summary.in_transit_lbs)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Being transferred
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatWeight(summary.at_risk_lbs)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="locations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">
            <MapPin className="h-4 w-4 mr-2" />
            Locations ({summary?.location_count || 0})
          </TabsTrigger>
          <TabsTrigger value="transfers">
            <Truck className="h-4 w-4 mr-2" />
            Active Transfers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          {locationsLoading ? (
            <div>Loading locations...</div>
          ) : locations && locations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {locations.map((location) => {
                const capacityPercent = getCapacityPercentage(
                  location.current_stock_lbs,
                  location.capacity_lbs
                );

                return (
                  <Card key={location.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {location.location_type === 'warehouse' && <Warehouse className="h-5 w-5" />}
                            {location.location_type === 'runner' && <Truck className="h-5 w-5" />}
                            {location.location_type === 'customer' && <MapPin className="h-5 w-5" />}
                            {location.location_name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {location.location_type.charAt(0).toUpperCase() + location.location_type.slice(1)}
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Stock</span>
                          <span className="font-semibold">
                            {formatWeight(location.current_stock_lbs)}
                          </span>
                        </div>
                        {location.capacity_lbs && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Capacity</span>
                              <span className="font-semibold">
                                {formatWeight(location.capacity_lbs)} max
                              </span>
                            </div>
                            <Progress value={capacityPercent} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{capacityPercent.toFixed(0)}% utilized</span>
                              <span>
                                {formatCurrency(location.total_value)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Packages</p>
                          <p className="text-lg font-semibold">{location.package_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Batches</p>
                          <p className="text-lg font-semibold">{location.batch_count}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No locations found</p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Location
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          {activeTransfers && activeTransfers.length > 0 ? (
            <div className="space-y-4">
              {activeTransfers.map((transfer: any) => (
                <Card key={transfer.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{transfer.transfer_number}</CardTitle>
                        <CardDescription className="mt-1">
                          {transfer.from_location?.location_name} → {transfer.to_location?.location_name}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={
                          transfer.status === 'completed' ? 'default' :
                          transfer.status === 'in_transit' ? 'secondary' :
                          'outline'
                        }
                      >
                        {transfer.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Quantity</p>
                        <p className="font-semibold">{formatWeight(transfer.total_quantity_lbs)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Value</p>
                        <p className="font-semibold">{formatCurrency(transfer.total_value || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Scheduled</p>
                        <p className="font-semibold">
                          {transfer.scheduled_at 
                            ? new Date(transfer.scheduled_at).toLocaleDateString()
                            : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No active transfers</p>
                <Button>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Create Transfer
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

