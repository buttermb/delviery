import { logger } from '@/lib/logger';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Edit, Trash2, Eye, EyeOff, Copy, Tag, 
  DollarSign, Package, TrendingUp, TrendingDown, Loader2
} from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { toast } from "sonner";

interface Product {
  id: string;
  [key: string]: unknown;
}

interface EnhancedBulkActionsProps {
  selectedCount: number;
  selectedProducts: string[];
  products: Product[];
  onBulkUpdate: (updates: Record<string, unknown>) => Promise<void>;
  onIndividualUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function EnhancedBulkActions({
  selectedCount,
  selectedProducts,
  products,
  onBulkUpdate,
  onIndividualUpdate,
  onBulkDelete,
  onClearSelection,
}: EnhancedBulkActionsProps) {
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [priceAdjustment, setPriceAdjustment] = useState<"increase" | "decrease">("increase");
  const [adjustmentPercent, setAdjustmentPercent] = useState("");
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAdjustingPrice, setIsAdjustingPrice] = useState(false);
  const [isSettingStock, setIsSettingStock] = useState(false);

  const selectedProductsData = products.filter((p) =>
    selectedProducts.includes(p.id)
  );

  const handleBulkPriceAdjustment = async () => {
    if (isAdjustingPrice) return;

    const percent = parseFloat(adjustmentPercent);
    if (isNaN(percent)) {
      toast.error("Please enter a valid percentage");
      return;
    }

    setIsAdjustingPrice(true);
    try {
      const multiplier = priceAdjustment === "increase" ? 1 + percent / 100 : 1 - percent / 100;
      
      // Update each product individually with their calculated price
      for (const id of selectedProducts) {
        const product = products.find((p) => p.id === id);
        if (product) {
          const price = Number(product.price) || 0;
          const newPrice = Math.max(0.01, price * multiplier);
          await onIndividualUpdate(id, { price: parseFloat(newPrice.toFixed(2)) });
        }
      }
      
      toast.success(`Price adjustment applied to ${selectedProducts.length} product(s)`);
      setPriceDialogOpen(false);
      setAdjustmentPercent("");
    } catch (error: unknown) {
      logger.error('Bulk price adjustment failed', error, { component: 'EnhancedBulkActions' });
      toast.error(error instanceof Error ? error.message : 'Failed to adjust prices');
    } finally {
      setIsAdjustingPrice(false);
    }
  };

  const totalValue = selectedProductsData.reduce(
    (sum, p) => sum + ((p.price || 0) as number) * ((p.stock_quantity || 0) as number),
    0
  );

  return (
    <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg mb-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-lg">
            {selectedCount} selected
          </Badge>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4" />
            <span>Total Value: ${totalValue.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Actions */}
          <Button
            size="sm"
            variant="secondary"
            disabled={isUpdating}
            onClick={async () => {
              if (isUpdating) return;
              setIsUpdating(true);
              try {
                await onBulkUpdate({ in_stock: true });
                toast.success(`${selectedCount} product(s) are now visible`);
              } catch (error: unknown) {
                logger.error('Bulk show failed', error, { component: 'EnhancedBulkActions' });
                toast.error(error instanceof Error ? error.message : 'Failed to show products');
              } finally {
                setIsUpdating(false);
              }
            }}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Show All
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isUpdating}
            onClick={async () => {
              if (isUpdating) return;
              setIsUpdating(true);
              try {
                await onBulkUpdate({ in_stock: false });
                toast.success(`${selectedCount} product(s) are now hidden`);
              } catch (error: unknown) {
                logger.error('Bulk hide failed', error, { component: 'EnhancedBulkActions' });
                toast.error(error instanceof Error ? error.message : 'Failed to hide products');
              } finally {
                setIsUpdating(false);
              }
            }}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide All
              </>
            )}
          </Button>

          {/* Bulk Price Adjustment */}
          <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <DollarSign className="mr-2 h-4 w-4" />
                Adjust Prices
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Price Adjustment</DialogTitle>
                <DialogDescription>
                  Adjust prices for {selectedCount} products
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Button
                    variant={priceAdjustment === "increase" ? "default" : "outline"}
                    onClick={() => setPriceAdjustment("increase")}
                    className="flex-1"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Increase
                  </Button>
                  <Button
                    variant={priceAdjustment === "decrease" ? "default" : "outline"}
                    onClick={() => setPriceAdjustment("decrease")}
                    className="flex-1"
                  >
                    <TrendingDown className="mr-2 h-4 w-4" />
                    Decrease
                  </Button>
                </div>

                <div>
                  <Label>Percentage</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 10 for 10%"
                    value={adjustmentPercent}
                    onChange={(e) => setAdjustmentPercent(e.target.value)}
                  />
                </div>

                <div className="bg-muted p-3 rounded">
                  <p className="text-sm font-medium mb-2">Preview:</p>
                  {selectedProductsData.slice(0, 3).map((product) => {
                    const percent = parseFloat(adjustmentPercent) || 0;
                    const multiplier =
                      priceAdjustment === "increase"
                        ? 1 + percent / 100
                        : 1 - percent / 100;
                    const currentPrice = Number(product.price) || 0;
                    const newPrice = (currentPrice * multiplier).toFixed(2);
                    return (
                      <div key={product.id} className="text-sm mb-1">
                        {String(product.name)}: ${String(currentPrice)} → ${String(newPrice)}
                      </div>
                    );
                  })}
                  {selectedProductsData.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      ...and {selectedProductsData.length - 3} more
                    </p>
                  )}
                </div>

                <Button 
                  onClick={handleBulkPriceAdjustment} 
                  className="w-full"
                  disabled={isAdjustingPrice}
                >
                  {isAdjustingPrice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    `Apply to ${selectedCount} Products`
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Set Stock */}
          <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <Package className="mr-2 h-4 w-4" />
                Set Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Stock Level</DialogTitle>
                <DialogDescription>
                  Set stock for {selectedCount} products
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Stock Quantity</Label>
                  <Input
                    type="number"
                    placeholder="Enter quantity"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (isSettingStock) return;
                    
                    const stock = parseInt(bulkStock);
                    if (isNaN(stock) || stock < 0) {
                      toast.error("Please enter a valid stock quantity");
                      return;
                    }

                    setIsSettingStock(true);
                    try {
                      await onBulkUpdate({ stock_quantity: stock, in_stock: stock > 0 });
                      toast.success(`Stock updated for ${selectedCount} product(s)`);
                      setBulkStock("");
                      setStockDialogOpen(false);
                    } catch (error: unknown) {
                      logger.error('Bulk stock update failed', error, { component: 'EnhancedBulkActions' });
                      toast.error(error instanceof Error ? error.message : 'Failed to update stock');
                    } finally {
                      setIsSettingStock(false);
                    }
                  }}
                  className="w-full"
                  disabled={isSettingStock}
                >
                  {isSettingStock ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Apply to All"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete */}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>

          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={onBulkDelete}
        itemType="products"
        description={`Are you sure you want to delete ${selectedCount} product${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
      />
    </div>
  );
}
