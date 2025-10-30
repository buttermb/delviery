import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Truck, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Courier {
  id: string;
  full_name: string;
  vehicle_type: string;
  vehicle_plate: string;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
}

export const AssignCourierDialog = ({
  orderId,
  orderAddress,
  open,
  onOpenChange,
  onSuccess,
}: {
  orderId: string;
  orderAddress: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) => {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAvailableCouriers();
    }
  }, [open]);

  const fetchAvailableCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from("couriers")
        .select("*")
        .eq("is_active", true)
        .order("is_online", { ascending: false });

      if (error) throw error;
      setCouriers(data || []);
    } catch (error) {
      console.error("Failed to fetch couriers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load available couriers",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedCourierId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a courier",
      });
      return;
    }

    setAssigning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/assign-courier`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId,
          courierId: selectedCourierId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign courier");
      }

      toast({
        title: "Success",
        description: "Courier assigned successfully",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to assign courier:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign courier",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleAutoAssign = async () => {
    setAssigning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/assign-courier`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId,
          // Don't send courierId to trigger auto-assignment
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to auto-assign courier");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: `Nearest courier (${result.courier.full_name}) assigned automatically`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to auto-assign courier:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to auto-assign courier",
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Courier</DialogTitle>
          <DialogDescription>
            Select a courier for delivery to: <strong>{orderAddress}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : couriers.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No couriers available at the moment
              </p>
            </div>
          ) : (
            <>
              <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a courier" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((courier) => (
                    <SelectItem key={courier.id} value={courier.id}>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        <span>{courier.full_name}</span>
                        <Badge variant={courier.is_online ? "default" : "secondary"} className="ml-2">
                          {courier.is_online ? "Online" : "Offline"}
                        </Badge>
                        {courier.current_lat && courier.current_lng && (
                          <MapPin className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {courier.vehicle_type} - {courier.vehicle_plate}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  onClick={handleAssign}
                  disabled={!selectedCourierId || assigning}
                  className="flex-1"
                >
                  {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Assign Selected
                </Button>
                <Button
                  onClick={handleAutoAssign}
                  disabled={assigning}
                  variant="outline"
                  className="flex-1"
                >
                  {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Auto-Assign Nearest
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};