import { logger } from '@/lib/logger';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, TrendingUp, TrendingDown, RefreshCw, FileDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatSmartDate } from '@/lib/formatters';

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
  const { tenant } = useTenantAdminAuth();

  const { data: movements = [], isLoading } = useQuery({
    queryKey: queryKeys.inventoryMovementsLog.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Query wholesale_inventory_movements with product info via wholesale_inventory
      const { data, error } = await supabase
        .from("wholesale_inventory_movements")
        .select(`
          id,
          movement_type,
          quantity,
          notes,
          created_at,
          wholesale_inventory:wholesale_inventory_id (
            strain_name,
            location
          )
        `)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("Error fetching inventory movements:", error);
        return [];
      }

      // Map to our interface
      interface MovementRow {
        id: string;
        movement_type?: string;
        quantity?: number;
        notes?: string;
        created_at: string;
        wholesale_inventory?: { strain_name?: string; location?: string } | null;
      }
      return (data ?? []).map((m: MovementRow) => ({
        id: m.id,
        product_name: m.wholesale_inventory?.strain_name || 'Unknown Product',
        movement_type: m.movement_type || 'adjustment',
        quantity_change: m.quantity || 0,
        from_location: m.wholesale_inventory?.location ?? '',
        to_location: '',
        notes: m.notes ?? '',
        created_at: m.created_at,
      })) as InventoryMovement[];
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000,
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "sale":
      case "deduction":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case "restock":
      case "addition":
      case "received":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "adjustment":
        return <RefreshCw className="h-4 w-4 text-info" />;
      case "transfer":
        return <ArrowRight className="h-4 w-4 text-warning" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "sale":
      case "deduction":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "restock":
      case "addition":
      case "received":
        return "bg-success/10 text-success border-success/20";
      case "adjustment":
        return "bg-info/10 text-info border-info/20";
      case "transfer":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const exportToCSV = () => {
    const headers = ["Date & Time", "Product", "Type", "Quantity", "Location", "Notes"];
    const rows = movements.map(m => [
      formatSmartDate(m.created_at, { includeTime: true }),
      m.product_name,
      m.movement_type,
      m.quantity_change,
      m.from_location || "-",
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
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))
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
                      {formatSmartDate(movement.created_at, { includeTime: true })}
                    </span>

                    {movement.from_location && (
                      <span className="flex items-center gap-1">
                        {movement.from_location}
                      </span>
                    )}

                    {movement.notes && (
                      <span className="italic line-clamp-2">"{movement.notes}"</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`font-mono font-semibold ${
                    movement.quantity_change > 0
                      ? "text-success"
                      : "text-destructive"
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
