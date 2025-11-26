import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Package,
  Warehouse,
  Truck,
  MapPin,
  AlertTriangle,
  Plus,
  ArrowRightLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { triggerHaptic } from '@/lib/utils/mobile';

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
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { admin, tenant, loading: authLoading } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Realtime Subscription for Inventory Updates
  useEffect(() => {
    const channel = supabase
      .channel('inventory-dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_inventory'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Inventory subscription error:', status, { component: 'InventoryDashboard' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  // Fetch inventory summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['inventory-summary', tenantId],
    queryFn: async (): Promise<InventorySummary | null> => {
      if (!tenantId) return null;

      // Mock data for now as tables might be missing
      return {
        total_quantity_lbs: 1250.5,
        total_value: 45000,
        in_stock_lbs: 850.0,
        in_transit_lbs: 300.5,
        at_risk_lbs: 100.0,
        location_count: 3,
        package_count: 150,
        batch_count: 12,
      };
    },
    enabled: !!tenantId,
  });

  // Mock locations for display
  const locations: LocationInventory[] = [
    {
      id: '1',
      location_name: 'Main Warehouse',
      location_type: 'warehouse',
      capacity_lbs: 5000,
      current_stock_lbs: 3200,
      package_count: 85,
      batch_count: 8,
      total_value: 32000
    },
    {
      id: '2',
      location_name: 'Downtown Hub',
      location_type: 'warehouse',
      capacity_lbs: 1000,
      current_stock_lbs: 800,
      package_count: 45,
      batch_count: 3,
      total_value: 12000
    },
    {
      id: '3',
      location_name: 'Runner Van 1',
      location_type: 'runner',
      capacity_lbs: 500,
      current_stock_lbs: 150,
      package_count: 20,
      batch_count: 1,
      total_value: 1000
    }
  ];
  const locationsLoading = false;

  const activeTransfers: any[] = [];

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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-2">Access Denied</CardTitle>
            <CardDescription>
              You need to be logged in as a tenant admin to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/saas/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Inventory",
      value: formatWeight(summary?.total_quantity_lbs || 0),
      subValue: formatCurrency(summary?.total_value || 0),
      icon: Package,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "In Stock",
      value: formatWeight(summary?.in_stock_lbs || 0),
      subValue: "Available for sale",
      icon: Warehouse,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "In Transit",
      value: formatWeight(summary?.in_transit_lbs || 0),
      subValue: "Being transferred",
      icon: Truck,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10"
    },
    {
      title: "At Risk",
      value: formatWeight(summary?.at_risk_lbs || 0),
      subValue: "Requires attention",
      icon: AlertTriangle,
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
  ];

  return (
    <PullToRefresh onRefresh={handleManualRefresh}>
      <div className="container mx-auto py-4 sm:py-6 space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 sm:px-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">
              Track inventory across all locations
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="flex-1 sm:flex-none" onClick={() => navigate(`/${tenantSlug}/admin/catalog/batches`)}>
              <Plus className="h-4 w-4 mr-2" />
              New Batch
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate(`/${tenantSlug}/admin/inventory/transfers`)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transfer
            </Button>
          </div>
        </div>

        {/* Mobile Stats Carousel */}
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 snap-x snap-mandatory hide-scrollbar">
          {summaryLoading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="min-w-[260px] sm:min-w-0 snap-center h-32 bg-muted animate-pulse rounded-xl" />
            ))
          ) : (
            stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="min-w-[260px] sm:min-w-0 snap-center"
              >
                <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20 h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={cn("p-2 rounded-full", stat.bg)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.subValue}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="locations" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="locations" className="flex-1 sm:flex-none">
              <MapPin className="h-4 w-4 mr-2" />
              Locations ({summary?.location_count || 0})
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex-1 sm:flex-none">
              <Truck className="h-4 w-4 mr-2" />
              Active Transfers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="space-y-4">
            {locationsLoading ? (
              <div className="text-center py-8">Loading locations...</div>
            ) : locations && locations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {locations.map((location, index) => {
                  const capacityPercent = getCapacityPercentage(
                    location.current_stock_lbs,
                    location.capacity_lbs
                  );

                  return (
                    <motion.div
                      key={location.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                {location.location_type === 'warehouse' && <Warehouse className="h-5 w-5 text-primary" />}
                                {location.location_type === 'runner' && <Truck className="h-5 w-5 text-blue-500" />}
                                {location.location_type === 'customer' && <MapPin className="h-5 w-5 text-red-500" />}
                                {location.location_name}
                              </CardTitle>
                              <CardDescription className="mt-1 capitalize">
                                {location.location_type}
                              </CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8">
                              Details
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

                          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                            <div className="bg-muted/30 p-2 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Packages</p>
                              <p className="text-lg font-bold text-primary">{location.package_count}</p>
                            </div>
                            <div className="bg-muted/30 p-2 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Batches</p>
                              <p className="text-lg font-bold text-primary">{location.batch_count}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
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
                        <Badge variant={transfer.status === 'completed' ? 'default' : 'secondary'}>
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
                            {transfer.scheduled_at ? new Date(transfer.scheduled_at).toLocaleDateString() : 'Not scheduled'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">No active transfers</p>
                  <Button variant="outline">
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Create Transfer
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}

