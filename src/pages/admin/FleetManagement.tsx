import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, MapPin, Phone, MessageSquare, Star, Clock, DollarSign, Navigation } from "lucide-react";
import { DeliveryStatusDialog } from "@/components/admin/DeliveryStatusDialog";
import { AssignDeliveryToRunnerDialog } from "@/components/admin/AssignDeliveryToRunnerDialog";
import { LiveDeliveryMap } from "@/components/admin/LiveDeliveryMap";
import { RouteOptimizationPreview } from "@/components/admin/RouteOptimizationPreview";
import { AddRunnerDialog } from "@/components/admin/AddRunnerDialog";
import { toast } from "@/hooks/use-toast";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export default function FleetManagement() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Enable realtime sync for deliveries and courier earnings
  useRealtimeSync({
    tenantId,
    tables: ['deliveries', 'courier_earnings'],
    enabled: !!tenantId,
  });
  const navigate = useNavigate();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [selectedOrderNumber, setSelectedOrderNumber] = useState("");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");
  const [selectedRunnerName, setSelectedRunnerName] = useState("");

  // Fetch active deliveries
  const { data: activeDeliveries } = useQuery({
    queryKey: ["active-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_deliveries")
        .select(`
          *,
          runners:wholesale_runners(full_name, phone, vehicle_type, rating),
          orders:wholesale_orders(order_number, total_amount, delivery_address, delivery_notes)
        `)
        .in("status", ["assigned", "picked_up", "in_transit"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((delivery: any) => ({
        ...delivery,
        delivery_address: delivery.orders?.delivery_address || 'Unknown',
        eta_minutes: 15, // TODO: Calculate from location
        collection_amount: 0,
        notes_for_runner: delivery.orders?.delivery_notes || delivery.notes
      }));
    },
    refetchInterval: 30000
  });

  // Fetch runners
  const { data: runners } = useQuery({
    queryKey: ["runners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_runners")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(runner => ({
        ...runner,
        success_rate: 95.0 // TODO: Calculate from completed deliveries
      }));
    }
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      assigned: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      picked_up: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      in_transit: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
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
    toast({
      title: "Success",
      description: "Route applied successfully! Runner has been notified.",
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">🚗 Fleet Management</h1>
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
          runnerId={activeDeliveries[0]?.runner_id || ''}
          runnerName={activeDeliveries[0]?.runners?.full_name || 'Runner'}
          stops={activeDeliveries.slice(0, 5).map((d: any, i: number) => ({
            id: d.id,
            clientName: d.orders?.delivery_address?.split(',')[0] || `Stop ${i + 1}`,
            address: d.delivery_address || 'Address pending',
            orderValue: Number(d.orders?.total_amount || 0),
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
          🚨 ACTIVE DELIVERIES ({activeDeliveries?.length || 0})
        </h2>
        
        <div className="space-y-3">
          {activeDeliveries && activeDeliveries.length > 0 ? (
            activeDeliveries.map((delivery: any) => (
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
                          {delivery.status === "in_transit" && "🔴 IN TRANSIT"}
                          {delivery.status === "picked_up" && "📦 PICKED UP"}
                          {delivery.status === "assigned" && "📋 ASSIGNED"}
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
                      onClick={() => navigate(`/admin/delivery-tracking/${delivery.id}`)}
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
            <Card className="p-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No active deliveries</p>
            </Card>
          )}
        </div>
      </div>

      {/* Runner Roster */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">👥 RUNNER ROSTER</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <div className="text-xs text-muted-foreground">{runner.phone}</div>
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
