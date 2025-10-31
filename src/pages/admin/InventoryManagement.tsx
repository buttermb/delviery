import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, ArrowUpDown, Settings } from "lucide-react";
import { useWholesaleInventory } from "@/hooks/useWholesaleData";
import { StockAdjustmentDialog } from "@/components/admin/StockAdjustmentDialog";

export default function InventoryManagement() {
  const { data: inventory = [], isLoading } = useWholesaleInventory();
  
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Group inventory by warehouse
  const groupedInventory = inventory.reduce((acc, item) => {
    const warehouse = item.warehouse_location || "Warehouse A";
    if (!acc[warehouse]) {
      acc[warehouse] = [];
    }
    acc[warehouse].push(item);
    return acc;
  }, {} as Record<string, typeof inventory>);

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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">📦 Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Wholesale scale inventory across multiple warehouses</p>
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600">
          + Add Stock
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Stock</span>
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold font-mono text-foreground">{totalStock.toFixed(0)} lbs</div>
          <div className="text-sm text-muted-foreground mt-1">{(totalStock * 0.453592).toFixed(0)} kg</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Value</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold font-mono text-foreground">${(totalValue / 1000).toFixed(0)}k</div>
          <div className="text-sm text-muted-foreground mt-1">at cost</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Avg Cost/lb</span>
            <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold font-mono text-foreground">${avgCostPerLb.toFixed(0)}</div>
          <div className="text-sm text-muted-foreground mt-1">average</div>
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
          const warehouseTotal = products.reduce((sum, p) => sum + Number(p.quantity_lbs || 0), 0);
          const warehouseValue = warehouseTotal * avgCostPerLb;
          const capacity = 500; // Default capacity

          return (
            <Card key={warehouseName} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">🏢 {warehouseName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Capacity: {capacity} lbs | Current: {warehouseTotal.toFixed(0)} lbs ({((warehouseTotal / capacity) * 100).toFixed(0)}%) | Value: ${(warehouseValue / 1000).toFixed(0)}k
                  </p>
                </div>
                <Badge variant={warehouseTotal / capacity > 0.5 ? "default" : "secondary"}>
                  {warehouseTotal / capacity > 0.5 ? "🟢 GOOD" : "🟡 LOW"}
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 text-sm font-semibold text-foreground">Product</th>
                      <th className="text-right py-3 text-sm font-semibold text-foreground">Weight</th>
                      <th className="text-right py-3 text-sm font-semibold text-foreground">Cost/lb</th>
                      <th className="text-right py-3 text-sm font-semibold text-foreground">Total Value</th>
                      <th className="text-center py-3 text-sm font-semibold text-foreground">Status</th>
                      <th className="text-center py-3 text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const qty = Number(product.quantity_lbs || 0);
                      const estimatedCost = avgCostPerLb;
                      const stockStatus = getStockStatus(qty, product.reorder_point || 20);
                      
                      return (
                        <tr key={product.id} className="border-b last:border-0">
                          <td className="py-3 text-sm font-medium text-foreground">{product.product_name}</td>
                          <td className="py-3 text-right text-sm font-mono text-foreground">{qty.toFixed(1)} lbs</td>
                          <td className="py-3 text-right text-sm font-mono text-foreground">${estimatedCost.toLocaleString()}</td>
                          <td className="py-3 text-right text-sm font-mono text-foreground">${(qty * estimatedCost).toLocaleString()}</td>
                          <td className="py-3 text-center">
                            <Badge variant={stockStatus.color as any} className="text-xs">
                              {stockStatus.status === "critical" && "🔴 CRITICAL"}
                              {stockStatus.status === "low" && "🟡 LOW"}
                              {stockStatus.status === "good" && "🟢 GOOD"}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setAdjustmentDialogOpen(true);
                                }}
                              >
                                <Settings className="h-3 w-3 mr-1" />
                                Adjust
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}

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
