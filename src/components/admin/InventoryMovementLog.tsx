import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, TrendingUp, TrendingDown, RefreshCw, FileDown } from "lucide-react";

interface InventoryMovement {
  id: string;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  from_location: string;
  to_location: string;
  notes: string;
  created_at: string;
}

export function InventoryMovementLog() {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: async () => {
      // Try product_movements table first (the current standard)
      const { data: productMovements, error: productError } = await supabase
        .from("product_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // If product_movements exists, use it
      if (!productError) {
        return (productMovements || []).map((m: any) => ({
          id: m.id,
          product_name: m.product_name || 'Unknown Product',
          movement_type: m.movement_type,
          quantity_change: m.quantity_change,
          from_location: m.from_location || '',
          to_location: m.to_location || '',
          notes: m.notes || '',
          created_at: m.created_at,
        })) as InventoryMovement[];
      }

      // Fallback to inventory_movements table
      if (productError && productError.code === '42P01') {
        const { data, error } = await supabase
          .from("inventory_movements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') return []; // Neither table exists
        if (error) throw error;
        return data as InventoryMovement[];
      }

      if (productError) throw productError;
      return [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "sale":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "restock":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "adjustment":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "transfer":
        return <ArrowRight className="h-4 w-4 text-amber-500" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "sale":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "restock":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "adjustment":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "transfer":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Time", "Product", "Type", "Quantity", "From", "To", "Notes"];
    const rows = movements.map(m => [
      new Date(m.created_at).toLocaleDateString(),
      new Date(m.created_at).toLocaleTimeString(),
      m.product_name,
      m.movement_type,
      m.quantity_change,
      m.from_location || "-",
      m.to_location || "-",
      m.notes || "-"
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-movements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Movement Log</h3>
          <Badge variant="outline">Last 50</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={exportToCSV}>
          <FileDown className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading movements...
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No inventory movements yet</p>
          </div>
        ) : (
          movements.map((movement) => (
            <div
              key={movement.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  {getMovementIcon(movement.movement_type)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {movement.product_name}
                    </span>
                    <Badge className={getMovementColor(movement.movement_type)}>
                      {movement.movement_type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {new Date(movement.created_at).toLocaleDateString()}{" "}
                      {new Date(movement.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {movement.from_location && movement.to_location && (
                      <span className="flex items-center gap-1">
                        {movement.from_location}
                        <ArrowRight className="h-3 w-3" />
                        {movement.to_location}
                      </span>
                    )}

                    {movement.notes && (
                      <span className="italic">"{movement.notes}"</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`font-mono font-semibold ${
                    movement.quantity_change > 0
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {movement.quantity_change > 0 ? "+" : ""}
                  {movement.quantity_change} lbs
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
