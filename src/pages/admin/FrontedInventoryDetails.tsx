import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { LoadingFallback } from "@/components/LoadingFallback";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

export default function FrontedInventoryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [front, setFront] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    loadFrontDetails();
    subscribeToUpdates();
  }, [id]);

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`front-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fronted_inventory",
          filter: `id=eq.${id}`,
        },
        () => loadFrontDetails()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadFrontDetails = async () => {
    try {
      // Load front details
      const { data: frontData, error: frontError } = await supabase
        .from("fronted_inventory")
        .select(`
          *,
          products (name, sku, barcode, category),
          inventory_locations (location_name, location_type, address)
        `)
        .eq("id", id)
        .single();

      if (frontError) throw frontError;
      setFront(frontData);
      setProduct(frontData.products);

      // Load scans
      const { data: scansData } = await supabase
        .from("fronted_inventory_scans")
        .select("*")
        .eq("fronted_inventory_id", id)
        .order("scanned_at", { ascending: false });

      setScans(scansData || []);

      // Load payments
      const { data: paymentsData } = await supabase
        .from("fronted_payments")
        .select("*")
        .eq("fronted_inventory_id", id)
        .order("received_at", { ascending: false });

      setPayments(paymentsData || []);
    } catch (error: any) {
      toast.error("Failed to load details: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingFallback />;
  if (!front) return <div>Front not found</div>;

  const soldPercentage = (front.quantity_sold / front.quantity_fronted) * 100;
  const returnedPercentage = (front.quantity_returned / front.quantity_fronted) * 100;
  const damagedPercentage = (front.quantity_damaged / front.quantity_fronted) * 100;
  const remainingPercentage = 100 - soldPercentage - returnedPercentage - damagedPercentage;

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const amountOwed = parseFloat(front.expected_revenue) - totalPaid;
  const isOverdue = front.payment_due_date && new Date(front.payment_due_date) < new Date() && amountOwed > 0;
  const daysOverdue = isOverdue
    ? Math.floor((Date.now() - new Date(front.payment_due_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/inventory/fronted")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Fronted Inventory #{front.id.slice(0, 8)}</h1>
            <p className="text-muted-foreground">
              {product?.name} • {front.quantity_fronted} units
            </p>
          </div>
        </div>
        <Badge
          variant={
            front.status === "completed"
              ? "default"
              : front.status === "cancelled"
              ? "destructive"
              : "secondary"
          }
        >
          {front.status.toUpperCase()}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Revenue</p>
              <p className="text-2xl font-bold">${parseFloat(front.expected_revenue).toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Profit</p>
              <p className="text-2xl font-bold">${parseFloat(front.expected_profit).toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Package className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Units Sold</p>
              <p className="text-2xl font-bold">
                {front.quantity_sold} / {front.quantity_fronted}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${isOverdue ? "bg-red-500/10" : "bg-yellow-500/10"}`}>
              {isOverdue ? (
                <AlertTriangle className="h-6 w-6 text-red-500" />
              ) : (
                <Clock className="h-6 w-6 text-yellow-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount Owed</p>
              <p className="text-2xl font-bold">${amountOwed.toFixed(2)}</p>
              {isOverdue && <p className="text-xs text-red-500">{daysOverdue} days overdue</p>}
            </div>
          </div>
        </Card>
      </div>

      {/* Basic Info */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Fronted To</p>
            <p className="font-medium">{front.fronted_to_customer_name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium">{front.inventory_locations?.location_name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deal Type</p>
            <p className="font-medium">{front.deal_type?.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dispatched</p>
            <p className="font-medium">
              {front.dispatched_at ? format(new Date(front.dispatched_at), "MMM dd, yyyy") : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Payment Due</p>
            <p className="font-medium">
              {front.payment_due_date ? format(new Date(front.payment_due_date), "MMM dd, yyyy") : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Payment Status</p>
            <Badge variant={front.payment_status === "paid" ? "default" : "secondary"}>
              {front.payment_status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Inventory Status */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Inventory Status</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm">Overall Progress</span>
              <span className="text-sm font-medium">{soldPercentage.toFixed(0)}% Sold</span>
            </div>
            <Progress value={soldPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Sold</p>
              <p className="text-2xl font-bold text-green-500">{front.quantity_sold}</p>
              <p className="text-xs text-muted-foreground">{soldPercentage.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unsold</p>
              <p className="text-2xl font-bold">
                {front.quantity_fronted - front.quantity_sold - front.quantity_returned - front.quantity_damaged}
              </p>
              <p className="text-xs text-muted-foreground">{remainingPercentage.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Returned</p>
              <p className="text-2xl font-bold text-blue-500">{front.quantity_returned}</p>
              <p className="text-xs text-muted-foreground">{returnedPercentage.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Damaged</p>
              <p className="text-2xl font-bold text-red-500">{front.quantity_damaged}</p>
              <p className="text-xs text-muted-foreground">{damagedPercentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Total Cost</span>
            <span className="font-medium">
              ${(parseFloat(front.cost_per_unit) * front.quantity_fronted).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expected Revenue</span>
            <span className="font-medium">${parseFloat(front.expected_revenue).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Expected Profit</span>
            <span className="font-bold">${parseFloat(front.expected_profit).toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payments Received</span>
            <span className="font-medium">${totalPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span className={isOverdue ? "text-red-500" : ""}>Amount Owed</span>
            <span className={isOverdue ? "text-red-500" : ""}>${amountOwed.toFixed(2)}</span>
          </div>
          {isOverdue && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{daysOverdue} days overdue</span>
            </div>
          )}
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
        <div className="space-y-4">
          {scans.map((scan) => (
            <div key={scan.id} className="flex gap-4 border-l-2 border-border pl-4 pb-4">
              <div className="flex-shrink-0">
                {scan.scan_type === "dispatch" && <Package className="h-5 w-5 text-blue-500" />}
                {scan.scan_type === "sold" && <DollarSign className="h-5 w-5 text-green-500" />}
                {scan.scan_type === "return" && <Package className="h-5 w-5 text-yellow-500" />}
                {scan.scan_type === "damage" && <AlertTriangle className="h-5 w-5 text-red-500" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{scan.scan_type.toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">
                  {scan.quantity} units • {format(new Date(scan.scanned_at), "MMM dd, yyyy HH:mm")}
                </p>
                {scan.notes && <p className="text-sm mt-1">{scan.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Payment History</h2>
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">${parseFloat(payment.amount).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {payment.payment_method} • {format(new Date(payment.received_at), "MMM dd, yyyy")}
                  </p>
                  {payment.notes && <p className="text-xs text-muted-foreground mt-1">{payment.notes}</p>}
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Button onClick={() => navigate(`/admin/inventory/fronted/${id}/sale`)}>
          <DollarSign className="h-4 w-4 mr-2" />
          Record Sale
        </Button>
        <Button variant="outline" onClick={() => navigate(`/admin/inventory/fronted/${id}/return`)}>
          <Package className="h-4 w-4 mr-2" />
          Scan Returns
        </Button>
        <Button variant="outline" onClick={() => navigate(`/admin/inventory/fronted/${id}/payment`)}>
          <DollarSign className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
        {front.notes && (
          <Button variant="ghost">
            <FileText className="h-4 w-4 mr-2" />
            View Notes
          </Button>
        )}
      </div>
    </div>
  );
}
