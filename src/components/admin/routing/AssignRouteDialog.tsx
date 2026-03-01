
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from "@/lib/logger";
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
import { Truck, Loader2 } from "lucide-react";
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

interface AssignRouteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAssign: (courierId: string, courierName: string) => void;
    stopCount: number;
}

export const AssignRouteDialog = ({
    open,
    onOpenChange,
    onAssign,
    stopCount,
}: AssignRouteDialogProps) => {
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [selectedCourierId, setSelectedCourierId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const { session: _session } = useAuth();

    useEffect(() => {
        const fetchAvailableCouriers = async () => {
            // In a real app, we should filter by the current tenant.
            // Assuming RLS handles visibility or we need a tenant ID context.
            // For this visual builder, we'll fetch all visible couriers.

            try {
                const { data, error } = await supabase
                    .from("couriers")
                    .select('id, full_name, vehicle_type, vehicle_plate, is_online, current_lat, current_lng')
                    .eq("is_active", true)
                    .order("is_online", { ascending: false });

                if (error) throw error;
                setCouriers(data ?? []);
            } catch (error) {
                logger.error("Failed to fetch couriers:", error);
                toast.error('Failed to load available couriers', { description: humanizeError(error) });
            } finally {
                setLoading(false);
            }
        };

        if (open) {
            fetchAvailableCouriers();
        }
    }, [open]);

    const handleAssign = () => {
        if (!selectedCourierId) return;

        const courier = couriers.find(c => c.id === selectedCourierId);
        if (courier) {
            setAssigning(true);
            // Simulate API call delay
            setTimeout(() => {
                onAssign(courier.id, courier.full_name);
                setAssigning(false);
                onOpenChange(false);
            }, 800);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Assign Route</DialogTitle>
                    <DialogDescription>
                        Assign this optimized route with <strong>{stopCount} stops</strong> to a courier.
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
                                No couriers available.
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
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                onClick={handleAssign}
                                disabled={!selectedCourierId || assigning}
                                className="w-full"
                            >
                                {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Assign Route
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
