import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, ArrowUpDown, Settings } from "lucide-react";
import { useWholesaleInventory } from "@/hooks/useWholesaleData";
import { StockAdjustmentDialog } from "@/components/admin/StockAdjustmentDialog";
import { InventoryMovementLog } from "@/components/admin/InventoryMovementLog";
import { BulkImageGenerator } from "@/components/admin/products/BulkImageGenerator";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { inventoryTutorial } from "@/lib/tutorials/tutorialConfig";

export default function InventoryManagement() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const { data: inventory = [], isLoading } = useWholesaleInventory(tenant?.id);

  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Memoize grouped inventory to prevent recalculation
  const groupedInventory = useMemo(() => {
    return inventory.reduce((acc, item) => {
      const warehouse = item.warehouse_location || "Warehouse A";
      if (!acc[warehouse]) {
        acc[warehouse] = [];
      }
      acc[warehouse].push(item);
      return acc;
    }, {} as Record<string, typeof inventory>);
  }, [inventory]);

  const totalStock = inventory.reduce((sum, item) => sum + Number(item.quantity_lbs || 0), 0);
  // Calculate estimated value at $3000/lb average
  const avgCostPerLb = 3000;
  const totalValue = totalStock * avgCostPerLb;

  const getStockStatus = (qty: number, reorderPoint: number = 20) => {
    if (qty <= 10) return { status: "critical", color: "destructive" };
    if (qty <= reorderPoint) return { status: "low", color: "warning" };
    return { status: "good", color: "default" };
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">📦 Inventory Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Wholesale scale inventory across multiple warehouses</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <BulkImageGenerator products={inventory} />
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation flex-1 sm:flex-initial text-sm sm:text-base min-w-[100px]"
            data-tutorial="add-product"
            onClick={() => {
              navigate('/admin/inventory/products');
              import("sonner").then(({ toast }) => {
                toast.info("Manage your product catalog and create new products here.", {
                  duration: 3000,
                });
              });
            }}
          >
            Manage Products
          </Button>
          <TakeTourButton
            tutorialId={inventoryTutorial.id}
            steps={inventoryTutorial.steps}
            variant="outline"
            size="sm"
            className="min-h-[44px]"
          />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4" data-tutorial="inventory-overview">
        <Card className="p-3 sm:p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Total Stock</span>
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground">{totalStock.toFixed(0)} lbs</div>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">{(totalStock * 0.453592).toFixed(0)} kg</div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Total Value</span>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground">${(totalValue / 1000).toFixed(0)}k</div>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">at cost</div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-5 sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Avg Cost/lb</span>
            <ArrowUpDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground">${avgCostPerLb.toFixed(0)}</div>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">average</div>
        </Card>
      </div>

      {/* Warehouses */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading inventory...</p>
        </Card>
      ) : Object.keys(groupedInventory).length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No inventory data. Set up sample data to get started.</p>
        </Card>
      ) : (
        Object.entries(groupedInventory).map(([warehouseName, products]) => {
          // Calculate warehouse totals (memoized at component level via groupedInventory)
          const warehouseTotal = products.reduce((sum, p) => sum + Number(p.quantity_lbs || 0), 0);
          const warehouseValue = warehouseTotal * avgCostPerLb;
          const capacity = 500; // Default capacity

          return (
            <Card key={warehouseName} className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">🏢 {warehouseName}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    Capacity: {capacity} lbs | Current: {warehouseTotal.toFixed(0)} lbs ({((warehouseTotal / capacity) * 100).toFixed(0)}%) | Value: ${(warehouseValue / 1000).toFixed(0)}k
                  </p>
                </div>
                <Badge variant={warehouseTotal / capacity > 0.5 ? "default" : "secondary"} className="text-xs sm:text-sm flex-shrink-0">
                  {warehouseTotal / capacity > 0.5 ? "🟢 GOOD" : "🟡 LOW"}
                </Badge>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full" data-tutorial="product-list">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 sm:py-3 text-xs sm:text-sm font-semibold text-foreground">Product</th>
                        <th className="text-right py-2 sm:py-3 text-xs sm:text-sm font-semibold text-foreground">Weight</th>
                        <th className="text-right py-2 sm:py-3 text-xs sm:text-sm font-semibold text-foreground">Cost/lb</th>
                        <th className="text-right py-2 sm:py-3 text-xs sm:text-sm font-semibold text-foreground">Total Value</th>
                        <th className="text-center py-2 sm:py-3 text-xs sm:text-sm font-semibold text-foreground">Status</th>
                        <th className="text-center py-2 sm:py-3 text-xs sm:text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const qty = Number(product.quantity_lbs || 0);
                        const estimatedCost = avgCostPerLb;
                        const stockStatus = getStockStatus(qty, product.reorder_point || 20);

                        return (
                          <tr key={product.id} className="border-b last:border-0 touch-manipulation">
                            <td className="py-2 sm:py-3 text-xs sm:text-sm font-medium text-foreground truncate max-w-[150px] sm:max-w-none">{product.product_name}</td>
                            <td className="py-2 sm:py-3 text-right text-xs sm:text-sm font-mono text-foreground">{qty.toFixed(1)} lbs</td>
                            <td className="py-2 sm:py-3 text-right text-xs sm:text-sm font-mono text-foreground">${estimatedCost.toLocaleString()}</td>
                            <td className="py-2 sm:py-3 text-right text-xs sm:text-sm font-mono text-foreground">${(qty * estimatedCost).toLocaleString()}</td>
                            <td className="py-2 sm:py-3 text-center">
                              <Badge variant={stockStatus.color as any} className="text-xs">
                                {stockStatus.status === "critical" && "🔴 CRITICAL"}
                                {stockStatus.status === "low" && "🟡 LOW"}
                                {stockStatus.status === "good" && "🟢 GOOD"}
                              </Badge>
                            </td>
                            <td className="py-2 sm:py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="min-h-[48px] min-w-[48px] px-2 text-xs sm:text-sm touch-manipulation"
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setAdjustmentDialogOpen(true);
                                  }}
                                  data-tutorial="stock-adjustments"
                                >
                                  <Settings className="h-3 w-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Adjust</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          );
        })
      )}

      {/* Movement Log */}
      <InventoryMovementLog />

      {/* Dialogs */}
      {selectedProduct && (
        <StockAdjustmentDialog
          productId={selectedProduct.id}
          productName={selectedProduct.product_name}
          currentQuantity={Number(selectedProduct.quantity_lbs || 0)}
          warehouse={selectedProduct.warehouse_location || "Warehouse A"}
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
        />
      )}
    </div>
  );
}
