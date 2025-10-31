import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Smartphone, Zap, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface GPSAnomaly {
  id: string;
  courier_id: string;
  order_id: string | null;
  anomaly_type: string;
  lat: number | null;
  lng: number | null;
  accuracy_meters: number | null;
  speed_mph: number | null;
  detected_at: string;
  resolved: boolean;
  admin_notified: boolean;
  courier: {
    full_name: string;
    phone: string;
  };
}

interface OverrideRequest {
  id: string;
  order_id: string;
  courier_id: string;
  current_distance_miles: number;
  reason: string | null;
  status: string;
  created_at: string;
  courier: {
    full_name: string;
    phone: string;
  };
  order: {
    order_number: string;
    delivery_address: string;
  };
}

export function AdminAlerts() {
  const [gpsAnomalies, setGpsAnomalies] = useState<GPSAnomaly[]>([]);
  const [overrideRequests, setOverrideRequests] = useState<OverrideRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
    
    // Subscribe to real-time updates
    const gpsChannel = supabase
      .channel("gps-anomalies")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "gps_anomalies",
      }, () => {
        loadAlerts();
      })
      .subscribe();

    const overrideChannel = supabase
      .channel("override-requests")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "override_requests",
      }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gpsChannel);
      supabase.removeChannel(overrideChannel);
    };
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    
    // Load unresolved GPS anomalies
    const { data: anomalies } = await supabase
      .from("gps_anomalies")
      .select(`
        *,
        courier:couriers(full_name, phone)
      `)
      .eq("resolved", false)
      .order("detected_at", { ascending: false })
      .limit(10);

    // Load pending override requests
    const { data: overrides } = await supabase
      .from("override_requests")
      .select(`
        *,
        courier:couriers(full_name, phone),
        order:orders(order_number, delivery_address)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    setGpsAnomalies(anomalies || []);
    setOverrideRequests(overrides || []);
    setLoading(false);
  };

  const resolveAnomaly = async (id: string) => {
    const { error } = await supabase
      .from("gps_anomalies")
      .update({ resolved: true })
      .eq("id", id);

    if (error) {
      toast.error("Failed to resolve anomaly");
    } else {
      toast.success("GPS anomaly resolved");
      loadAlerts();
    }
  };

  const handleOverride = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from("override_requests")
      .update({
        status: approved ? "approved" : "denied",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update override request");
    } else {
      toast.success(`Override ${approved ? "approved" : "denied"}`);
      loadAlerts();
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case "mock_location": return <Smartphone className="h-4 w-4" />;
      case "impossible_speed": return <Zap className="h-4 w-4" />;
      case "low_accuracy": return <MapPin className="h-4 w-4" />;
      case "offline": return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAnomalyLabel = (type: string) => {
    switch (type) {
      case "mock_location": return "Fake GPS";
      case "impossible_speed": return "Impossible Speed";
      case "low_accuracy": return "Low GPS Accuracy";
      case "offline": return "GPS Offline";
      default: return type;
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading alerts...</div>;
  }

  const totalAlerts = gpsAnomalies.length + overrideRequests.length;

  if (totalAlerts === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
          <p>No active alerts</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* GPS Anomalies */}
      {gpsAnomalies.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            GPS Anomalies ({gpsAnomalies.length})
          </h3>
          <div className="space-y-3">
            {gpsAnomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive" className="flex items-center gap-1">
                      {getAnomalyIcon(anomaly.anomaly_type)}
                      {getAnomalyLabel(anomaly.anomaly_type)}
                    </Badge>
                    <span className="text-sm font-medium">
                      {anomaly.courier.full_name}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Phone: {anomaly.courier.phone}</div>
                    {anomaly.accuracy_meters && (
                      <div>Accuracy: {anomaly.accuracy_meters}m</div>
                    )}
                    {anomaly.speed_mph && (
                      <div>Speed: {anomaly.speed_mph.toFixed(1)} mph</div>
                    )}
                    <div className="text-xs">
                      {new Date(anomaly.detected_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveAnomaly(anomaly.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Override Requests */}
      {overrideRequests.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Geofence Override Requests ({overrideRequests.length})
          </h3>
          <div className="space-y-3">
            {overrideRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">
                      Order #{request.order.order_number}
                    </Badge>
                    <span className="text-sm font-medium">
                      {request.courier.full_name}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Distance: {request.current_distance_miles.toFixed(2)} miles</div>
                    <div>Address: {request.order.delivery_address}</div>
                    {request.reason && (
                      <div className="italic">Reason: "{request.reason}"</div>
                    )}
                    <div className="text-xs">
                      {new Date(request.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleOverride(request.id, true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleOverride(request.id, false)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
