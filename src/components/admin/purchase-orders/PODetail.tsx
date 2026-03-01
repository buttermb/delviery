import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Calendar,
  DollarSign,
  Package,
  Edit,
  X,
  FileText,
  CheckCircle2,
  Truck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/queryKeys";
import { POReceiveDialog } from "./POReceiveDialog";
import type { Database } from "@/integrations/supabase/types";
import { formatSmartDate, formatCurrency } from '@/lib/formatters';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];

interface PODetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
  onEdit: () => void;
  onStatusChange: (po: PurchaseOrder, newStatus: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500 dark:bg-gray-600",
  submitted: "bg-blue-500",
  approved: "bg-green-500",
  received: "bg-emerald-500",
  cancelled: "bg-red-500",
};

export function PODetail({ open, onOpenChange, purchaseOrder, onEdit, onStatusChange }: PODetailProps) {
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: queryKeys.purchaseOrders.items(purchaseOrder.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select('id, product_name, quantity, unit_cost, total_cost, received_quantity, created_at')
        .eq("purchase_order_id", purchaseOrder.id)
        .order("created_at", { ascending: true });

      if (error) {
        logger.error('Failed to fetch purchase order items', error, { component: 'PODetail' });
        return [];
      }

      return (data ?? []) as PurchaseOrderItem[];
    },
    enabled: open && !!purchaseOrder.id,
  });

  const { data: vendor } = useQuery({
    queryKey: queryKeys.vendor.detail(purchaseOrder.vendor_id),
    queryFn: async () => {
      // Try vendors table first
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("id", purchaseOrder.vendor_id)
        .maybeSingle();

      if (vendorData) return vendorData;

      // Fallback to wholesale_suppliers
      const { data: supplierData } = await supabase
        .from("wholesale_suppliers")
        .select("id, supplier_name as name")
        .eq("id", purchaseOrder.vendor_id)
        .maybeSingle();

      return supplierData;
    },
    enabled: open && !!purchaseOrder.vendor_id,
  });

  const canEdit = purchaseOrder.status === "draft";
  const canChangeStatus = purchaseOrder.status !== "cancelled" && purchaseOrder.status !== "received";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {purchaseOrder.po_number}
            </DialogTitle>
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Vendor */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant="outline"
                    className={`${STATUS_COLORS[purchaseOrder.status || "draft"]} text-white border-0 mt-1`}
                  >
                    {(purchaseOrder.status || "draft").charAt(0).toUpperCase() +
                      (purchaseOrder.status || "draft").slice(1)}
                  </Badge>
                </div>
                {canChangeStatus && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={purchaseOrder.status || "draft"}
                      onValueChange={(value) => onStatusChange(purchaseOrder, value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Vendor</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{(vendor && 'name' in vendor ? vendor.name : null) || "Unknown Vendor"}</span>
                  </div>
                </div>
                {purchaseOrder.expected_delivery_date && (
                  <div>
                    <div className="text-sm text-muted-foreground">Expected Delivery</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatSmartDate(purchaseOrder.expected_delivery_date)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {purchaseOrder.notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notes</div>
                  <div className="p-3 bg-muted rounded-lg">{purchaseOrder.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                Products included in this purchase order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading items...
                </div>
              ) : items && items.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-4 font-medium text-sm text-muted-foreground pb-2 border-b">
                    <div>Product</div>
                    <div className="text-right">Quantity</div>
                    <div className="text-right">Unit Cost</div>
                    <div className="text-right">Total Cost</div>
                    <div className="text-right">Received</div>
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-5 gap-4 py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {item.product_name}
                      </div>
                      <div className="text-right">{item.quantity}</div>
                      <div className="text-right">
                        {formatCurrency(item.unit_cost)}
                      </div>
                      <div className="text-right font-medium">
                        {formatCurrency(item.total_cost)}
                      </div>
                      <div className="text-right">
                        {item.received_quantity ?? 0} / {item.quantity}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No items found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">
                    {formatCurrency(purchaseOrder.subtotal ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium">
                    {formatCurrency(purchaseOrder.tax ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span className="font-medium">
                    {formatCurrency(purchaseOrder.shipping ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {Number(purchaseOrder.total || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>
                  {purchaseOrder.created_at
                    ? formatSmartDate(purchaseOrder.created_at)
                    : "N/A"}
                </span>
              </div>
              {purchaseOrder.updated_at &&
                purchaseOrder.updated_at !== purchaseOrder.created_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span>{formatSmartDate(purchaseOrder.updated_at)}</span>
                  </div>
                )}
              {purchaseOrder.received_date && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Received:</span>
                  <span>{formatSmartDate(purchaseOrder.received_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] touch-manipulation"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>

          {canEdit && (
            <Button
              onClick={onEdit}
              className="min-h-[44px] touch-manipulation"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {purchaseOrder.status === "approved" && (
            <Button
              onClick={() => setReceiveDialogOpen(true)}
              className="min-h-[44px] touch-manipulation bg-emerald-500 hover:bg-emerald-600"
            >
              <Truck className="h-4 w-4 mr-2" />
              Receive Items
            </Button>
          )}

          {canChangeStatus && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Change Status:</span>
              <Select
                value={purchaseOrder.status || "draft"}
                onValueChange={(value) => onStatusChange(purchaseOrder, value)}
              >
                <SelectTrigger className="w-[150px] min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Receive Dialog */}
      <POReceiveDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        purchaseOrder={purchaseOrder}
        items={items ?? []}
        onSuccess={() => {
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
