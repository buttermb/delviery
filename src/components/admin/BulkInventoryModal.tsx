import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ArrowUp, ArrowDown, Replace, Package } from "lucide-react";

type AdjustmentType = "add" | "subtract" | "set";

interface BulkProduct {
  id: string;
  name: string;
  available_quantity: number;
  warehouse_location?: string;
}

interface BulkInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: BulkProduct[];
  onComplete: () => void;
}

interface PreviewItem {
  id: string;
  name: string;
  currentQty: number;
  newQty: number;
  change: number;
  warehouse: string;
  error?: string;
}

export function BulkInventoryModal({
  open,
  onOpenChange,
  selectedProducts,
  onComplete,
}: BulkInventoryModalProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setAdjustmentType("add");
    setQuantity("");
    setReason("");
    setNotes("");
  };

  const parsedQuantity = parseFloat(quantity) || 0;

  const previewItems: PreviewItem[] = useMemo(() => {
    if (!parsedQuantity || parsedQuantity <= 0) return [];

    return selectedProducts.map((product) => {
      const currentQty = Number(product.available_quantity || 0);
      let newQty: number;
      let change: number;

      switch (adjustmentType) {
        case "add":
          newQty = currentQty + parsedQuantity;
          change = parsedQuantity;
          break;
        case "subtract":
          newQty = Math.max(0, currentQty - parsedQuantity);
          change = -(Math.min(parsedQuantity, currentQty));
          break;
        case "set":
          newQty = parsedQuantity;
          change = parsedQuantity - currentQty;
          break;
      }

      const error = adjustmentType === "subtract" && parsedQuantity > currentQty
        ? "Quantity will be clamped to 0"
        : undefined;

      return {
        id: product.id,
        name: product.name,
        currentQty,
        newQty,
        change,
        warehouse: product.warehouse_location || "Warehouse A",
        error,
      };
    });
  }, [selectedProducts, adjustmentType, parsedQuantity]);

  const hasWarnings = previewItems.some((item) => item.error);

  const bulkAdjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("No tenant context");
      if (previewItems.length === 0) throw new Error("No items to adjust");

      const results: { productId: string; success: boolean; error?: string }[] = [];

      for (const item of previewItems) {
        try {
          // Update the product stock quantity
          const { error: updateError } = await supabase
            .from("products")
            .update({
              available_quantity: item.newQty,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)
            .eq("tenant_id", tenant.id);

          if (updateError) throw updateError;

          // Record inventory movement history entry
           const { error: historyError } = await (supabase as any)
            .from("wholesale_inventory_movements")
            .insert({
              tenant_id: tenant.id,
              inventory_id: item.id,
              product_name: item.name,
              movement_type: `bulk_${adjustmentType}`,
              quantity_change: item.change,
              notes: [
                `Bulk ${adjustmentType}: ${reason}`,
                notes ? `Notes: ${notes}` : "",
                `Previous: ${item.currentQty.toFixed(2)} lbs -> New: ${item.newQty.toFixed(2)} lbs`,
              ].filter(Boolean).join(" | "),
              from_location: item.warehouse,
            });

          if (historyError) {
            logger.error("Failed to record inventory history", historyError, {
              component: "BulkInventoryModal",
              productId: item.id,
            });
            // Don't fail the whole operation for history logging issues
          }

          results.push({ productId: item.id, success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          logger.error("Bulk adjustment failed for product", error, {
            component: "BulkInventoryModal",
            productId: item.id,
          });
          results.push({ productId: item.id, success: false, error: errorMessage });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount > 0 && successCount === 0) {
        throw new Error(`All ${failCount} adjustments failed`);
      }

      return { successCount, failCount, total: results.length };
    },
    onSuccess: ({ successCount, failCount }) => {
      if (failCount > 0) {
        toast.warning(`Adjusted ${successCount} products, ${failCount} failed`);
      } else {
        toast.success(`Successfully adjusted ${successCount} products`);
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-wholesale"] });

      resetForm();
      onOpenChange(false);
      onComplete();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Bulk adjustment failed";
      logger.error("Bulk inventory adjustment failed", error, {
        component: "BulkInventoryModal",
      });
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedQuantity || parsedQuantity < 0 || !reason || selectedProducts.length === 0) return;
    bulkAdjustmentMutation.mutate();
  };

  const getAdjustmentIcon = () => {
    switch (adjustmentType) {
      case "add": return <ArrowUp className="h-4 w-4 text-emerald-500" />;
      case "subtract": return <ArrowDown className="h-4 w-4 text-destructive" />;
      case "set": return <Replace className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bulk Inventory Adjustment
          </DialogTitle>
          <DialogDescription>
            Adjust inventory for {selectedProducts.length} selected product{selectedProducts.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Adjustment Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Adjustment Type <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Select
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
            >
              <SelectTrigger id="adjustment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">
                  <span className="flex items-center gap-2">
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                    Add Stock
                  </span>
                </SelectItem>
                <SelectItem value="subtract">
                  <span className="flex items-center gap-2">
                    <ArrowDown className="h-3 w-3 text-destructive" />
                    Reduce Stock
                  </span>
                </SelectItem>
                <SelectItem value="set">
                  <span className="flex items-center gap-2">
                    <Replace className="h-3 w-3 text-blue-500" />
                    Set to Amount
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-quantity">
              {adjustmentType === "set" ? "New Quantity" : "Quantity"} (lbs) *
            </Label>
            <Input
              id="bulk-quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Reason Selector */}
          <div className="space-y-2">
            <Label htmlFor="bulk-reason">Reason <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger id="bulk-reason">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receiving">Receiving/Restock</SelectItem>
                <SelectItem value="damage">Damage/Loss</SelectItem>
                <SelectItem value="theft">Theft</SelectItem>
                <SelectItem value="quality">Quality Issue</SelectItem>
                <SelectItem value="count">Count Correction</SelectItem>
                <SelectItem value="audit">Audit Adjustment</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="bulk-notes">Notes</Label>
            <Textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about this bulk adjustment..."
              rows={2}
            />
          </div>

          {/* Preview Section */}
          {previewItems.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {getAdjustmentIcon()}
                Preview Changes
              </Label>
              <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                <div className="divide-y">
                  {previewItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.warehouse}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="font-mono text-muted-foreground">
                          {item.currentQty.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono font-medium">
                          {item.newQty.toFixed(1)}
                        </span>
                        <Badge
                          variant={item.change > 0 ? "default" : item.change < 0 ? "destructive" : "secondary"}
                          className="text-xs min-w-[60px] justify-center"
                        >
                          {item.change > 0 ? "+" : ""}{item.change.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {hasWarnings && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Some products have insufficient stock. Quantities will be set to 0 instead of going negative.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={bulkAdjustmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !parsedQuantity ||
                !reason ||
                selectedProducts.length === 0 ||
                bulkAdjustmentMutation.isPending
              }
              variant={adjustmentType === "subtract" ? "destructive" : "default"}
            >
              {bulkAdjustmentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adjusting...
                </>
              ) : (
                `Adjust ${selectedProducts.length} Product${selectedProducts.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
