import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Package, Building2, FileText } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import type { Database } from "@/integrations/supabase/types";

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderInsert = Database['public']['Tables']['purchase_orders']['Insert'];
type PurchaseOrderItemInsert = Database['public']['Tables']['purchase_order_items']['Insert'];

interface POItem {
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

type Step = "supplier" | "products" | "review";

interface POCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder | null;
  onSuccess?: () => void;
}

export function POCreateForm({ open, onOpenChange, purchaseOrder, onSuccess }: POCreateFormProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>("supplier");
  const [formData, setFormData] = useState({
    vendor_id: "",
    expected_delivery_date: "",
    notes: "",
  });
  const [items, setItems] = useState<POItem[]>([]);
  const [newItem, setNewItem] = useState({
    product_name: "",
    quantity: 1,
    unit_cost: 0,
  });

  // Fetch vendors (suppliers)
  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      // Try to fetch from vendors table, fallback to wholesale_suppliers
      const { data: vendorsData } = await supabase
        .from("vendors")
        .select("id, name")
        .limit(100);

      if (vendorsData && vendorsData.length > 0) {
        return vendorsData;
      }

      // Fallback to wholesale_suppliers
      const { data: suppliersData } = await supabase
        .from("wholesale_suppliers")
        .select("id, supplier_name as name")
        .limit(100);

      return suppliersData || [];
    },
  });

  useEffect(() => {
    if (purchaseOrder && open) {
      setFormData({
        vendor_id: purchaseOrder.vendor_id,
        expected_delivery_date: purchaseOrder.expected_delivery_date || "",
        notes: purchaseOrder.notes || "",
      });
      // Load items for editing
      loadPOItems(purchaseOrder.id);
    } else if (open) {
      // Reset form for new PO
      setFormData({
        vendor_id: "",
        expected_delivery_date: "",
        notes: "",
      });
      setItems([]);
      setCurrentStep("supplier");
    }
  }, [purchaseOrder, open]);

  const loadPOItems = async (poId: string) => {
    const { data } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", poId);

    if (data) {
      setItems(data.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
      })));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_cost, 0);
    const tax = subtotal * 0.1; // 10% tax (configurable)
    const shipping = 0; // Can be added later
    const total = subtotal + tax + shipping;
    return { subtotal, tax, shipping, total };
  };

  const addItem = () => {
    if (!newItem.product_name || newItem.quantity <= 0 || newItem.unit_cost <= 0) {
      toast.error("Please fill in all item fields");
      return;
    }

    const total_cost = newItem.quantity * newItem.unit_cost;
    setItems([...items, { ...newItem, total_cost }]);
    setNewItem({ product_name: "", quantity: 1, unit_cost: 0 });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const generatePONumber = () => {
    const prefix = "PO";
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  };

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseOrderInsert) => {
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .insert([data])
        .select()
        .single();

      if (poError) throw poError;

      // Insert items
      if (items.length > 0 && poData) {
        const itemsToInsert: PurchaseOrderItemInsert[] = items.map(item => ({
          purchase_order_id: poData.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
        }));

        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return poData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success("Purchase order created successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create purchase order', error, { component: 'POCreateForm' });
      toast.error("Failed to create purchase order");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PurchaseOrderInsert) => {
      if (!purchaseOrder?.id) throw new Error("Purchase order ID is required");

      const { error: poError } = await supabase
        .from("purchase_orders")
        .update(data)
        .eq("id", purchaseOrder.id);

      if (poError) throw poError;

      // Delete existing items and insert new ones
      await supabase
        .from("purchase_order_items")
        .delete()
        .eq("purchase_order_id", purchaseOrder.id);

      if (items.length > 0) {
        const itemsToInsert: PurchaseOrderItemInsert[] = items.map(item => ({
          purchase_order_id: purchaseOrder.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
        }));

        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(purchaseOrder!.id) });
      toast.success("Purchase order updated successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to update purchase order', error, { component: 'POCreateForm' });
      toast.error("Failed to update purchase order");
    },
  });

  const handleSubmit = async () => {
    if (!formData.vendor_id) {
      toast.error("Please select a supplier");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const { subtotal, tax, shipping, total } = calculateTotals();
    const isEditing = !!purchaseOrder;

    const poData: PurchaseOrderInsert = {
      po_number: purchaseOrder?.po_number || generatePONumber(),
      vendor_id: formData.vendor_id,
      status: "draft",
      subtotal,
      tax,
      shipping,
      total,
      expected_delivery_date: formData.expected_delivery_date || null,
      notes: formData.notes || null,
      account_id: tenant?.id || "", // Using tenant_id as account_id for now
    };

    if (isEditing) {
      await updateMutation.mutateAsync(poData);
    } else {
      await createMutation.mutateAsync(poData);
    }
  };

  const steps: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "supplier", label: "Select Supplier", icon: Building2 },
    { key: "products", label: "Add Products", icon: Package },
    { key: "review", label: "Review", icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder ? "Edit Purchase Order" : "Create New Purchase Order"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.key;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isActive ? "bg-emerald-500 text-white" : ""}
                      ${isCompleted ? "bg-emerald-500/20 text-emerald-500" : ""}
                      ${!isActive && !isCompleted ? "bg-muted text-muted-foreground" : ""}
                    `}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs mt-2 ${isActive ? "font-semibold" : ""}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${isCompleted ? "bg-emerald-500" : "bg-muted"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {currentStep === "supplier" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_id">
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vendor_id: value })
                  }
                >
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((vendor: any) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                <Input
                  id="expected_delivery_date"
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expected_delivery_date: e.target.value })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes for this purchase order"
                  rows={3}
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
            </div>
          )}

          {currentStep === "products" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="product_name">Product Name</Label>
                  <Input
                    id="product_name"
                    value={newItem.product_name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, product_name: e.target.value })
                    }
                    placeholder="Enter product name"
                    className="min-h-[44px] touch-manipulation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) =>
                      setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                    }
                    className="min-h-[44px] touch-manipulation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_cost">Unit Cost</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.unit_cost}
                    onChange={(e) =>
                      setNewItem({ ...newItem, unit_cost: parseFloat(e.target.value) || 0 })
                    }
                    className="min-h-[44px] touch-manipulation"
                  />
                </div>
              </div>
              <Button onClick={addItem} variant="outline" className="w-full">
                <Package className="h-4 w-4 mr-2" />
                Add Item
              </Button>

              {items.length > 0 && (
                <div className="space-y-2">
                  <Label>Items ({items.length})</Label>
                  <div className="border rounded-lg divide-y">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × ${item.unit_cost.toFixed(2)} = ${item.total_cost.toFixed(2)}
                          </div>
                        </div>
                        <Button
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
                </div>
              )}
            </div>
          )}

          {currentStep === "review" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <div className="p-3 bg-muted rounded-lg">
                  {/* @ts-expect-error - vendor type mismatch */}
                  {vendors?.find((v: { id: string; name: string }) => v.id === formData.vendor_id)?.name || "Not selected"}
                </div>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  <Label>Items</Label>
                  <div className="border rounded-lg divide-y">
                    {items.map((item, index) => (
                      <div key={index} className="p-3 flex justify-between">
                        <span>{item.product_name}</span>
                        <span className="font-medium">
                          {item.quantity} × ${item.unit_cost.toFixed(2)} = ${item.total_cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (10%):</span>
                  <span className="font-medium">${calculateTotals().tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span className="font-medium">${calculateTotals().shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>${calculateTotals().total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStepIndex > 0) {
                setCurrentStep(steps[currentStepIndex - 1].key);
              } else {
                onOpenChange(false);
              }
            }}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStepIndex < steps.length - 1 ? (
            <Button
              onClick={() => {
                if (currentStep === "supplier" && !formData.vendor_id) {
                  toast.error("Please select a supplier");
                  return;
                }
                setCurrentStep(steps[currentStepIndex + 1].key);
              }}
              className="min-h-[44px] touch-manipulation"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {purchaseOrder ? "Update Purchase Order" : "Create Purchase Order"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

