import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { invalidateOnEvent } from "@/lib/invalidation";

interface Product {
  id: string;
  name: string;
  price?: number;
  stock_quantity?: number;
  in_stock?: boolean;
  [key: string]: unknown; // Allow additional properties
}

interface QuickEditDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickEditDialog({ product, open, onOpenChange }: QuickEditDialogProps) {
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [status, setStatus] = useState<"active" | "inactive">("inactive");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  // Sync state when product changes
  useEffect(() => {
    if (product) {
      setPrice(product.price || 0);
      setStock(product.stock_quantity || 0);
      setStatus(product.in_stock ? "active" : "inactive");
    }
  }, [product]);

  const updateProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({
          price,
          stock_quantity: stock,
          in_stock: status === "active",
        })
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: "✓ Product updated successfully" });
      onOpenChange(false);

      // Cross-panel invalidation - product update affects POS, storefront, inventory, wholesale
      if (tenant?.id && product) {
        invalidateOnEvent(queryClient, 'PRODUCT_UPDATED', tenant.id, {
          productId: product.id,
        });
      }
    },
    onError: (error: unknown) => {
      logger.error('Failed to update product', error, { component: 'QuickEditDialog' });
      toast({
        title: "Failed to update product",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  });

  // Don't render if product is null - prevents SelectItem mismatch
  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Edit: {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="quick-price">Price</Label>
            <div className="flex items-center mt-1.5">
              <span className="mr-2">$</span>
              <Input
                id="quick-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="quick-stock">Stock</Label>
            <Input
              id="quick-stock"
              type="number"
              value={stock}
              onChange={(e) => setStock(parseInt(e.target.value))}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">units</p>
          </div>

          <div>
            <Label htmlFor="quick-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                try {
                  updateProduct.mutate();
                } catch (error) {
                  logger.error('Button click error', error, { component: 'QuickEditDialog' });
                }
              }}
              disabled={updateProduct.isPending}
              className="flex-1"
            >
              {updateProduct.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
