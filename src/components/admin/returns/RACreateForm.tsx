import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeTextareaInput, sanitizeFormInput } from "@/lib/utils/sanitize";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logActivityAuto, ActivityActions } from "@/lib/activityLogger";

interface ReturnItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ReturnAuthorization {
  id?: string;
  ra_number?: string;
  order_id: string;
  order_number?: string;
  customer_id?: string;
  customer_name?: string;
  status: string;
  reason: string;
  return_method: string;
  total_amount: number;
  notes?: string;
}

interface RACreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnAuth?: ReturnAuthorization | null;
  onSuccess?: () => void;
}

export function RACreateForm({ open, onOpenChange, returnAuth, onSuccess }: RACreateFormProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    order_id: "",
    order_number: "",
    customer_id: "",
    customer_name: "",
    reason: "defective",
    return_method: "pickup",
    notes: "",
  });
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [newItem, setNewItem] = useState({
    product_name: "",
    quantity: 1,
    unit_price: 0,
  });

  // Fetch orders for selection
  const { data: orders, isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: queryKeys.orders.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_number, customer_id, total_amount")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  useEffect(() => {
    if (returnAuth && open) {
      setFormData({
        order_id: returnAuth.order_id || "",
        order_number: returnAuth.order_number || "",
        customer_id: returnAuth.customer_id || "",
        customer_name: returnAuth.customer_name || "",
        reason: returnAuth.reason || "defective",
        return_method: returnAuth.return_method || "pickup",
        notes: returnAuth.notes || "",
      });
    } else if (open) {
      setFormData({
        order_id: "",
        order_number: "",
        customer_id: "",
        customer_name: "",
        reason: "defective",
        return_method: "pickup",
        notes: "",
      });
      setItems([]);
    }
  }, [returnAuth, open]);

  const _generateRANumber = () => {
    const prefix = "RA";
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  };

  const addItem = () => {
    if (!newItem.product_name || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      toast.error("Please fill in all item fields");
      return;
    }

    const total_price = newItem.quantity * newItem.unit_price;
    setItems([...items, { ...newItem, total_price }]);
    setNewItem({ product_name: "", quantity: 1, unit_price: 0 });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const createMutation = useMutation({
    mutationFn: async (_data: { order_id: string; reason: string; items: Array<{ product_id: string; quantity: number; reason?: string }> }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      // Use the edge function for return processing
      const { data: result, error } = await supabase.functions.invoke('process-return', {
        body: {
          tenant_id: tenant.id,
          customer_id: formData.customer_id || undefined,
          order_id: formData.order_id,
          items: items.map(item => ({
            product_id: '',  // Would be fetched from order
            product_name: sanitizeFormInput(item.product_name, 200),
            quantity_lbs: item.quantity,
            price_per_lb: item.unit_price,
            subtotal: item.total_price,
            reason: formData.reason,
            condition: 'unopened',  // Default, could be made configurable
            disposition: 'restock'  // Default, could be made configurable
          })),
          reason: formData.reason,
          notes: formData.notes ? sanitizeTextareaInput(formData.notes, 1000) : formData.notes
        }
      });

      if (error) throw error;
      
      // Check for 2xx response with error in body
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to process return';
        throw new Error(errorMessage);
      }
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.returns.lists() });
      toast.success(`Return ${data.ra_number} created successfully. Refund: $${data.refund_amount}`);

      // Log activity for audit trail
      if (tenant?.id) {
        logActivityAuto(
          tenant.id,
          ActivityActions.CREATE_RETURN,
          'return_authorization',
          data.return_id || data.ra_number,
          {
            ra_number: data.ra_number,
            order_id: formData.order_id,
            order_number: formData.order_number,
            reason: formData.reason,
            refund_amount: data.refund_amount,
            items_count: items.length,
          }
        );
      }

      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create return authorization', error, { component: 'RACreateForm' });
      toast.error("Failed to create return authorization");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.order_id) {
      toast.error("Please select an order");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item to return");
      return;
    }

    await createMutation.mutateAsync({
      order_id: formData.order_id,
      reason: formData.reason,
      items: items.map(item => ({
        product_id: '',
        quantity: item.quantity,
        reason: formData.reason
      }))
    });
  };

  const isLoading = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {returnAuth ? "Edit Return Authorization" : "Create Return Authorization"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_id">
                Order <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.order_id}
                onValueChange={(value) => {
                  const order = orders?.find((o: { id: string; order_number?: string }) => o.id === value);
                  setFormData({
                    ...formData,
                    order_id: value,
                    order_number: order?.order_number || "",
                    customer_id: order?.customer_id || "",
                  });
                }}
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select an order" />
                </SelectTrigger>
                <SelectContent>
                  {ordersLoading ? (
                    <SelectItem value="_loading" disabled>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading orders...
                      </span>
                    </SelectItem>
                  ) : ordersError ? (
                    <SelectItem value="_error" disabled>
                      <span className="text-destructive">Failed to load orders</span>
                    </SelectItem>
                  ) : !orders || orders.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      <span className="text-muted-foreground">No orders found</span>
                    </SelectItem>
                  ) : (
                    orders.map((order: { id: string; order_number?: string; created_at?: string; total_amount?: number }) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number || order.id.substring(0, 8)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.reason}
                onValueChange={(value) => setFormData({ ...formData, reason: value })}
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="defective">Defective Product</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                  <SelectItem value="compliance">Compliance Issue</SelectItem>
                  <SelectItem value="customer_request">Customer Request</SelectItem>
                  <SelectItem value="damaged">Damaged in Transit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_method">
                Return Method <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.return_method}
                onValueChange={(value) => setFormData({ ...formData, return_method: value })}
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select return method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="ship_back">Ship Back</SelectItem>
                  <SelectItem value="destroy">Destroy (Compliance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this return"
                rows={3}
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4 border-t pt-4">
            <Label>Return Items</Label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Input
                  placeholder="Product name"
                  value={newItem.product_name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, product_name: e.target.value })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit price"
                  value={newItem.unit_price}
                  onChange={(e) =>
                    setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
            </div>
            <Button type="button" onClick={addItem} variant="outline" className="w-full">
              Add Item
            </Button>

            {items.length > 0 && (
              <div className="border rounded-lg divide-y">
                {items.map((item, index) => (
                  <div key={index} className="p-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} × ${item.unit_price.toFixed(2)} = ${item.total_price.toFixed(2)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <div className="text-lg font-bold">
                  Total: ${calculateTotal().toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {returnAuth ? "Update Return Authorization" : "Create Return Authorization"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

