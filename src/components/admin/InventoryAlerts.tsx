import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, TrendingDown } from "lucide-react";
import { useWholesaleInventory } from "@/hooks/useWholesaleData";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export function InventoryAlerts() {
  const { tenant } = useTenantAdminAuth();
  const { data: inventory = [] } = useWholesaleInventory(tenant?.id);

  const lowStockItems = inventory
    .filter(item => item.quantity_lbs < item.reorder_point)
    .sort((a, b) => {
      const aPercent = (a.quantity_lbs / a.reorder_point) * 100;
      const bPercent = (b.quantity_lbs / b.reorder_point) * 100;
      return aPercent - bPercent;
    });

  const criticalItems = lowStockItems.filter(item => 
    (item.quantity_lbs / item.reorder_point) * 100 < 25
  );

  if (lowStockItems.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 border-l-4 border-l-warning">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        Inventory Alerts ({lowStockItems.length})
      </h2>

      {criticalItems.length > 0 && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-destructive">
              CRITICAL - {criticalItems.length} products below 25%
            </span>
          </div>
          <div className="space-y-2">
            {criticalItems.map(item => {
              const stockPercent = (item.quantity_lbs / item.reorder_point) * 100;
              return (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {String((item as unknown as Record<string, unknown>).warehouse_location || 'Main')} | {item.quantity_lbs.toFixed(1)} lbs left
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      {stockPercent.toFixed(0)}%
                    </Badge>
                    <Button size="sm" variant="destructive">
                      Restock Now
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {lowStockItems.filter(item => {
          const percent = (item.quantity_lbs / item.reorder_point) * 100;
          return percent >= 25;
        }).map(item => {
          const stockPercent = (item.quantity_lbs / item.reorder_point) * 100;
          return (
            <div key={item.id} className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">{item.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {String((item as unknown as Record<string, unknown>).warehouse_location || 'Main')} | {item.quantity_lbs.toFixed(1)} lbs (reorder at {item.reorder_point} lbs)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-warning/10 text-warning border-warning/20">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {stockPercent.toFixed(0)}%
                </Badge>
                <Button size="sm" variant="outline">
                  Restock
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm">Generate Restock Order</Button>
        <Button variant="outline" size="sm">Contact Supplier</Button>
      </div>
    </Card>
  );
}
