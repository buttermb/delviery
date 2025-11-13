import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle } from "lucide-react";

export function InventoryOptimization() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Optimization</CardTitle>
          <CardDescription>
            Optimize stock levels to minimize costs while avoiding stockouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Inventory optimization coming soon.</p>
            <p className="text-sm mt-2">
              Get AI recommendations for optimal inventory levels based on demand patterns and lead times.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

