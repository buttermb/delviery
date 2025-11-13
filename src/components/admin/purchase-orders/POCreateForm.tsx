// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { logger } from "@/lib/logger";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import type { Database } from "@/integrations/supabase/types";

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderInsert = Database['public']['Tables']['purchase_orders']['Insert'];
type PurchaseOrderItemInsert = Database['public']['Tables']['purchase_order_items']['Insert'];

interface POItem {
  product_id: string;
  product_name: string;
  quantity_lbs: number;
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
  const { createPurchaseOrder } = usePurchaseOrders();
  const [currentStep, setCurrentStep] = useState<Step>("supplier");
  const [formData, setFormData] = useState({
    supplier_id: "",
    expected_delivery_date: "",
    notes: "",
  });
  const [items, setItems] = useState<POItem[]>([]);
  const [newItem, setNewItem] = useState({
    product_id: "",
    product_name: "",
    quantity_lbs: 1,
    unit_cost: 0,
  });

  // Fetch vendors
  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, contact_name")
        .eq("status", "active")
        .order("name");

      if (error) {
        logger.error('Failed to fetch vendors', error, { component: 'POCreateForm' });
        throw error;
      }

      return data || [];
    },
  });

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .order("name");

      if (error) {
        logger.error('Failed to fetch products', error, { component: 'POCreateForm' });
        throw error;
      }

      return data || [];
    },
  });

  useEffect(() => {
    if (open && !purchaseOrder) {
      // Reset form for new PO
      setFormData({
        supplier_id: "",
        expected_delivery_date: "",
        notes: "",
      });
      setItems([]);
      setNewItem({ product_id: "", product_name: "", quantity_lbs: 1, unit_cost: 0 });
      setCurrentStep("supplier");
    }
  }, [open, purchaseOrder]);

  const calculateTotals = () => {
    return items.reduce((sum, item) => sum + item.total_cost, 0);
  };

  const addItem = () => {
    if (!newItem.product_id || !newItem.product_name || newItem.quantity_lbs <= 0 || newItem.unit_cost <= 0) {
      toast.error("Please fill in all item fields");
      return;
    }

    const total_cost = newItem.quantity_lbs * newItem.unit_cost;
    setItems([...items, { ...newItem, total_cost }]);
    setNewItem({ product_id: "", product_name: "", quantity_lbs: 1, unit_cost: 0 });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.supplier_id) {
      toast.error("Please select a supplier");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    try {
      await createPurchaseOrder.mutateAsync({
        supplier_id: formData.supplier_id,
        expected_delivery_date: formData.expected_delivery_date || undefined,
        notes: formData.notes || undefined,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity_lbs: item.quantity_lbs,
          unit_cost: item.unit_cost,
        })),
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the hook
      logger.error('Submit failed', error, { component: 'POCreateForm' });
    }
  };

  const steps: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "supplier", label: "Select Supplier", icon: Building2 },
    { key: "products", label: "Add Products", icon: Package },
    { key: "review", label: "Review", icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const isLoading = createPurchaseOrder.isPending;

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
                <Label htmlFor="supplier_id">
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, supplier_id: value })
                  }
                >
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name || vendor.contact_name}
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
                  <Label htmlFor="product_id">Product</Label>
                  <Select
                    value={newItem.product_id}
                    onValueChange={(value) => {
                      const product = products?.find(p => p.id === value);
                      setNewItem({ 
                        ...newItem, 
                        product_id: value,
                        product_name: product?.name || ""
                      });
                    }}
                  >
                    <SelectTrigger className="min-h-[44px] touch-manipulation">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity_lbs">Quantity (lbs)</Label>
                  <Input
                    id="quantity_lbs"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newItem.quantity_lbs}
                    onChange={(e) =>
                      setNewItem({ ...newItem, quantity_lbs: parseFloat(e.target.value) || 0 })
                    }
                    className="min-h-[44px] touch-manipulation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_cost">Cost per lb ($)</Label>
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
                            {item.quantity_lbs} lbs × ${item.unit_cost.toFixed(2)} = ${item.total_cost.toFixed(2)}
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
                <Label>Vendor</Label>
                <div className="p-3 bg-muted rounded-lg">
                  {vendors?.find((v) => v.id === formData.supplier_id)?.name || "Not selected"}
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
                          {item.quantity_lbs} lbs × ${item.unit_cost.toFixed(2)} = ${item.total_cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-emerald-600">${calculateTotals().toFixed(2)}</span>
                </div>
              </div>

              {formData.notes && (
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <div className="p-3 bg-muted rounded-lg whitespace-pre-wrap">
                    {formData.notes}
                  </div>
                </div>
              )}
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
                if (currentStep === "supplier" && !formData.supplier_id) {
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

