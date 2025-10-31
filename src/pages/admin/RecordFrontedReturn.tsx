import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { ArrowLeft, Package, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScannedReturn {
  barcode: string;
  condition: "good" | "damaged";
  reason?: string;
}

export default function RecordFrontedReturn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [front, setFront] = useState<any>(null);
  const [scannedReturns, setScannedReturns] = useState<ScannedReturn[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadFrontDetails();
  }, [id]);

  const loadFrontDetails = async () => {
    const { data, error } = await supabase
      .from("fronted_inventory")
      .select(`
        *,
        products (name, sku, barcode)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to load details");
      return;
    }
    setFront(data);
  };

  const handleScan = (barcode: string) => {
    // Check if already scanned
    if (scannedReturns.find((r) => r.barcode === barcode)) {
      toast.error("Item already scanned");
      return;
    }

    setScannedReturns([...scannedReturns, { barcode, condition: "good" }]);
    toast.success("Item scanned");
  };

  const updateCondition = (barcode: string, condition: "good" | "damaged") => {
    setScannedReturns(
      scannedReturns.map((r) => (r.barcode === barcode ? { ...r, condition } : r))
    );
  };

  const updateReason = (barcode: string, reason: string) => {
    setScannedReturns(
      scannedReturns.map((r) => (r.barcode === barcode ? { ...r, reason } : r))
    );
  };

  const removeReturn = (barcode: string) => {
    setScannedReturns(scannedReturns.filter((r) => r.barcode !== barcode));
  };

  const handleProcessReturn = async () => {
    if (scannedReturns.length === 0) {
      toast.error("No items scanned");
      return;
    }

    setProcessing(true);
    try {
      const goodReturns = scannedReturns.filter((r) => r.condition === "good").length;
      const damagedReturns = scannedReturns.filter((r) => r.condition === "damaged").length;

      // Update fronted inventory
      const { error: updateError } = await supabase
        .from("fronted_inventory")
        .update({
          quantity_returned: front.quantity_returned + goodReturns,
          quantity_damaged: front.quantity_damaged + damagedReturns,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Create scan records
      for (const returnItem of scannedReturns) {
        await supabase.from("fronted_inventory_scans").insert({
          account_id: front.account_id,
          fronted_inventory_id: id,
          product_id: front.product_id,
          barcode: returnItem.barcode,
          scan_type: returnItem.condition === "good" ? "return" : "damage",
          quantity: 1,
          notes: returnItem.reason || notes,
        });
      }

      // Update product inventory for good returns
      if (goodReturns > 0) {
        const { data: product } = await supabase
          .from("products")
          .select("available_quantity")
          .eq("id", front.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ available_quantity: product.available_quantity + goodReturns })
            .eq("id", front.product_id);
        }
      }

      toast.success(
        `Return processed: ${goodReturns} returned to inventory, ${damagedReturns} marked as damaged`
      );
      navigate(`/admin/inventory/fronted/${id}`);
    } catch (error: any) {
      toast.error("Failed to process return: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!front) return <div>Loading...</div>;

  const goodReturns = scannedReturns.filter((r) => r.condition === "good").length;
  const damagedReturns = scannedReturns.filter((r) => r.condition === "damaged").length;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/inventory/fronted/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Scan Returns</h1>
          <p className="text-muted-foreground">
            {front.products?.name} • Front #{id.slice(0, 8)}
          </p>
        </div>
      </div>

      {/* Scanner */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Scan Returned Items</h2>
            <Button onClick={() => setIsScanning(!isScanning)}>
              {isScanning ? "Stop Scanning" : "Start Scanning"}
            </Button>
          </div>

          {isScanning && (
            <div className="border-2 border-dashed rounded-lg p-4">
              <BarcodeScanner onScan={handleScan} />
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{scannedReturns.length}</p>
              <p className="text-sm text-muted-foreground">Total Scanned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{goodReturns}</p>
              <p className="text-sm text-muted-foreground">Good Condition</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{damagedReturns}</p>
              <p className="text-sm text-muted-foreground">Damaged</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Scanned Items */}
      {scannedReturns.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Scanned Items</h2>
          <div className="space-y-4">
            {scannedReturns.map((returnItem) => (
              <div
                key={returnItem.barcode}
                className="flex items-start gap-4 p-4 border rounded-lg"
              >
                <div className="flex-shrink-0">
                  {returnItem.condition === "good" ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-medium">{returnItem.barcode}</p>
                    <Badge variant={returnItem.condition === "good" ? "default" : "destructive"}>
                      {returnItem.condition.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                      value={returnItem.condition}
                      onValueChange={(value: "good" | "damaged") =>
                        updateCondition(returnItem.barcode, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good - Return to Inventory</SelectItem>
                        <SelectItem value="damaged">Damaged - Write Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {returnItem.condition === "damaged" && (
                    <div className="space-y-2">
                      <Label>Reason for Damage</Label>
                      <Input
                        placeholder="e.g., Package opened, expired, broken seal..."
                        value={returnItem.reason || ""}
                        onChange={(e) => updateReason(returnItem.barcode, e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeReturn(returnItem.barcode)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes */}
      <Card className="p-6">
        <div className="space-y-2">
          <Label>Additional Notes</Label>
          <Textarea
            placeholder="Any additional notes about these returns..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(`/admin/inventory/fronted/${id}`)}>
          Cancel
        </Button>
        <Button onClick={handleProcessReturn} disabled={scannedReturns.length === 0 || processing}>
          <Package className="h-4 w-4 mr-2" />
          {processing ? "Processing..." : `Process ${scannedReturns.length} Returns`}
        </Button>
      </div>
    </div>
  );
}
