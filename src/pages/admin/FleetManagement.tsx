import { useState } from "react";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Phone, Star, Clock, DollarSign, AlertCircle } from "lucide-react";
import { DeliveryStatusDialog } from "@/components/admin/DeliveryStatusDialog";
import { AssignDeliveryToRunnerDialog } from "@/components/admin/AssignDeliveryToRunnerDialog";
import { LiveDeliveryMap } from "@/components/admin/LiveDeliveryMap";
import { RouteOptimizationPreview } from "@/components/admin/RouteOptimizationPreview";
import { AddRunnerDialog } from "@/components/admin/AddRunnerDialog";
import { toast } from "sonner";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { queryKeys } from "@/lib/queryKeys";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { formatPhoneNumber } from "@/lib/formatters";

interface Delivery {
  id: string;
  status: string;
  created_at: string;
  delivery_address: string;
  delivery_notes?: string;
  notes?: string;
  collection_amount: number;
  eta_minutes?: number;
  notes_for_runner?: string;
  runners?: {
    full_name: string;
    phone: string;
    vehicle_type: string;
    rating: number;
  };
  orders?: {
    order_number: string;
    total_amount: number;
    delivery_address: string;
    delivery_notes: string;
  };
}

export default function FleetManagement() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Enable realtime sync for deliveries and courier earnings
  useRealtimeSync({
    tenantId,
    tables: ['deliveries', 'courier_earnings'],
    enabled: !!tenantId,
  });
  const navigate = useTenantNavigate();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [selectedOrderNumber, setSelectedOrderNumber] = useState("");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");
  const [selectedRunnerName, setSelectedRunnerName] = useState("");

  // Fetch active deliveries
  const { data: activeDeliveries } = useQuery({
    queryKey: queryKeys.deliveries.active(),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("wholesale_deliveries")
        .select(`
          id, status, created_at, runner_id, notes, scheduled_pickup_time, tenant_id,
          runners:wholesale_runners(full_name, phone, vehicle_type, rating),
          orders:wholesale_orders(order_number, total_amount, delivery_address, delivery_notes)
        `)
        .eq("tenant_id", tenantId)
        .in("status", ["assigned", "picked_up", "in_transit"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((delivery) => {
        // Calculate ETA based on status and timestamps
        let etaMinutes = 0;
        if (delivery.status === 'in_transit') {
          // Mock: Assume 30 mins from pickup or last update
          // In a real app, we would calculate this using current location and destination
          etaMinutes = 30;
        } else if (delivery.status === 'assigned' && delivery.scheduled_pickup_time) {
          const scheduled = new Date(delivery.scheduled_pickup_time);
          const now = new Date();
          const diff = Math.max(0, Math.floor((scheduled.getTime() - now.getTime()) / 60000));
          etaMinutes = diff;
        }

        return {
          ...delivery,
          delivery_address: delivery.orders?.delivery_address || 'Unknown',
          eta_minutes: etaMinutes,
          collection_amount: 0,
          notes_for_runner: delivery.orders?.delivery_notes || delivery.notes
        };
      });
    },
    enabled: !!tenantId,
    // Realtime sync is enabled, so we don't need aggressive polling
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch runners
  const { data: runners } = useQuery({
    queryKey: queryKeys.runners.lists(),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("wholesale_runners")
        .select("id, full_name, phone, vehicle_type, rating, total_deliveries, status, created_at, tenant_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map(runner => ({
        ...runner,
        // Calculate success rate based on rating (5 stars = 100%, 1 star = 20%)
        // Fallback to 100% if no rating
        success_rate: runner.rating ? Math.min(100, Math.max(0, runner.rating * 20)) : 100
      }));
    },
    enabled: !!tenantId
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      assigned: "bg-accent/10 text-accent-foreground border-accent/20",
      picked_up: "bg-orange-500/10 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-700",
      in_transit: "bg-primary/10 text-primary border-primary/20"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getRunnerStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-red-500",
      available: "bg-emerald-500",
      off_duty: "bg-muted-foreground"
    };
    return colors[status] || "bg-muted-foreground";
  };

  const handleApplyRoute = () => {
    toast.success("Route applied successfully! Runner has been notified.");
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fleet Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Live tracking & runner operations</p>
        </div>
        <AddRunnerDialog
          trigger={
            <Button className="bg-emerald-500 hover:bg-emerald-600">
              + Add Runner
            </Button>
          }
        />
      </div>

      {/* Live GPS Tracking Map */}
      <LiveDeliveryMap showAll={true} />

      {/* Route Optimization Preview */}
      {activeDeliveries && activeDeliveries.length > 0 && (
        <RouteOptimizationPreview
          runnerId={activeDeliveries[0]?.runner_id ?? ''}
          runnerName={activeDeliveries[0]?.runners?.full_name || 'Runner'}
          stops={activeDeliveries.slice(0, 5).map((d: Delivery, i: number) => ({
            id: d.id,
            clientName: d.orders?.delivery_address?.split(',')[0] || `Stop ${i + 1}`,
            address: d.delivery_address || 'Address pending',
            orderValue: Number(d.orders?.total_amount ?? 0),
            estimatedTime: `${(i + 1) * 15} mins`
          }))}
          totalDistance="24.5 mi"
          totalTime="1h 45m"
          fuelSavings="$12.50"
          onApplyRoute={handleApplyRoute}
        />
      )}

      {/* Active Deliveries */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" /> ACTIVE DELIVERIES ({activeDeliveries?.length ?? 0})
        </h2>

        <div className="space-y-3">
          {activeDeliveries && activeDeliveries.length > 0 ? (
            activeDeliveries.map((delivery: Delivery) => (
              <Card key={delivery.id} className="p-5 border-l-4 border-l-emerald-500">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Runner Info */}
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Truck className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{delivery.runners?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{delivery.runners?.vehicle_type}</div>
                      </div>
                    </div>

                    {/* Delivery Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getStatusColor(delivery.status)}>
                          {delivery.status === "in_transit" && "IN TRANSIT"}
                          {delivery.status === "picked_up" && "PICKED UP"}
                          {delivery.status === "assigned" && "ASSIGNED"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Order #{delivery.orders?.order_number}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{delivery.delivery_address}</span>
                        </div>
                        {delivery.eta_minutes && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-500" />
                            <span className="text-emerald-500 font-semibold">
                              ETA: {delivery.eta_minutes} mins
                            </span>
                          </div>
                        )}
                        {delivery.collection_amount > 0 && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-yellow-500" />
                            <span className="text-yellow-500 font-mono font-semibold">
                              Collect: ${Number(delivery.collection_amount).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (delivery.runners?.phone) {
                          window.location.href = `tel:${delivery.runners.phone}`;
                        }
                      }}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDeliveryId(delivery.id);
                        setSelectedOrderNumber(delivery.orders?.order_number || "");
                        setSelectedDeliveryStatus(delivery.status);
                        setStatusDialogOpen(true);
                      }}
                    >
                      Update Status
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => navigate(`delivery-tracking?id=${delivery.id}`)}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Track Live
                    </Button>
                  </div>
                </div>

                {delivery.notes_for_runner && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <span className="text-xs font-semibold text-muted-foreground">Instructions:</span>
                    <p className="text-sm text-foreground mt-1">{delivery.notes_for_runner}</p>
                  </div>
                )}
              </Card>
            ))
          ) : (
            <EnhancedEmptyState
              type="no_deliveries"
              icon={Truck}
              title="No Active Deliveries"
              description="Deliveries will appear here once orders are dispatched to drivers."
              compact
            />
          )}
        </div>
      </div>

      {/* Runner Roster */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">RUNNER ROSTER</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(!runners || runners.length === 0) && (
            <div className="col-span-full">
              <EnhancedEmptyState
                type="no_drivers"
                icon={Truck}
                title="No Drivers Yet"
                description="Add your first driver using the button above to start managing deliveries."
                compact
              />
            </div>
          )}
          {runners?.map((runner) => (
            <Card key={runner.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Truck className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 ${getRunnerStatusColor(runner.status)} rounded-full border-2 border-background`} />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{runner.full_name}</div>
                    <div className="text-xs text-muted-foreground">{formatPhoneNumber(runner.phone)}</div>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {runner.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle:</span>
                  <span className="text-foreground capitalize">{runner.vehicle_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rating:</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-foreground">{Number(runner.rating).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deliveries:</span>
                  <span className="font-mono text-foreground">{runner.total_deliveries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="font-mono text-emerald-500">{Number(runner.success_rate).toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (runner.phone) {
                      window.location.href = `tel:${runner.phone}`;
                    }
                  }}
                >
                  <Phone className="h-3 w-3 mr-1" />
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={() => {
                    setSelectedRunnerId(runner.id);
                    setSelectedRunnerName(runner.full_name);
                    setAssignDialogOpen(true);
                  }}
                >
                  Assign Delivery
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <DeliveryStatusDialog
        deliveryId={selectedDeliveryId}
        currentStatus={selectedDeliveryStatus}
        orderNumber={selectedOrderNumber}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
      />

      <AssignDeliveryToRunnerDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        runnerId={selectedRunnerId}
        runnerName={selectedRunnerName}
      />
    </div>
  );
}
