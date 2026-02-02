import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Package from "lucide-react/dist/esm/icons/package";
import { useReceivePurchaseOrder } from "@/hooks/useReceivePurchaseOrder";
import type { Database } from "@/integrations/supabase/types";

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];

interface POReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
  items: PurchaseOrderItem[];
  onSuccess?: () => void;
}

export function POReceiveDialog({ 
  open, 
  onOpenChange, 
  purchaseOrder, 
  items,
  onSuccess 
}: POReceiveDialogProps) {
  const { receivePurchaseOrder } = useReceivePurchaseOrder();
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && items) {
      // Initialize quantities with ordered amounts
      const initialQuantities: Record<string, number> = {};
      items.forEach(item => {
        initialQuantities[item.id] = item.quantity || 0;
      });
      setQuantities(initialQuantities);
      setReceivedDate(new Date().toISOString().split('T')[0]);
    }
  }, [open, items]);

  const handleSubmit = async () => {
    if (!purchaseOrder) return;

    const receiveItems = items.map(item => ({
      item_id: item.id,
      quantity_received: quantities[item.id] || 0,
    }));

    try {
      await receivePurchaseOrder.mutateAsync({
        purchase_order_id: purchaseOrder.id,
        items: receiveItems,
        received_date: receivedDate,
        notes,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const isLoading = receivePurchaseOrder.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Receive Purchase Order: {purchaseOrder?.po_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="received_date">Received Date</Label>
            <Input
              id="received_date"
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            <div className="border rounded-lg divide-y">
              {items?.map((item) => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">Product ID: {item.product_id?.substring(0, 8)}...</div>
                      <div className="text-sm text-muted-foreground">
                        Ordered: {item.quantity} @ ${Number(item.unit_cost).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${Number(item.total_cost).toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`qty-${item.id}`} className="flex-shrink-0">
                      Quantity Received:
                    </Label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={quantities[item.id] || 0}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [item.id]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="max-w-[120px] min-h-[44px] touch-manipulation"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Receiving Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the received items (damages, shortages, etc.)"
              rows={3}
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation bg-emerald-500 hover:bg-emerald-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Receiving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Receive Items
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
