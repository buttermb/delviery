import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, DollarSign, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface ValuationData {
  totalValue: number;
  totalUnits: number;
  averageCost: number;
  categoryBreakdown: {
    category: string;
    value: number;
    units: number;
    percentage: number;
  }[];
  warehouseBreakdown: {
    warehouse: string;
    value: number;
    units: number;
    percentage: number;
  }[];
}

export function ValuationReport() {
  const { tenant } = useTenantAdminAuth();
  const [isExporting, setIsExporting] = useState(false);

  const { data: valuationData, isLoading } = useQuery({
    queryKey: queryKeys.inventory.valuation(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error("No tenant");

      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, category, available_quantity, cost_per_unit, wholesale_price, warehouse_location")
        .eq("tenant_id", tenant.id)
        .eq("archived", false);

      if (error) throw error;

      let totalValue = 0;
      let totalUnits = 0;
      const categoryMap = new Map<string, { value: number; units: number }>();
      const warehouseMap = new Map<string, { value: number; units: number }>();

      products.forEach((product) => {
        const quantity = Number(product.available_quantity ?? 0);
        const cost = Number(product.cost_per_unit ?? product.wholesale_price ?? 0);
        const value = quantity * cost;

        totalValue += value;
        totalUnits += quantity;

        // Category breakdown
        const category = product.category || "Uncategorized";
        const categoryData = categoryMap.get(category) || { value: 0, units: 0 };
        categoryMap.set(category, {
          value: categoryData.value + value,
          units: categoryData.units + quantity,
        });

        // Warehouse breakdown
        const warehouse = product.warehouse_location || "Unknown";
        const warehouseData = warehouseMap.get(warehouse) || { value: 0, units: 0 };
        warehouseMap.set(warehouse, {
          value: warehouseData.value + value,
          units: warehouseData.units + quantity,
        });
      });

      const averageCost = totalUnits > 0 ? totalValue / totalUnits : 0;

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          value: data.value,
          units: data.units,
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

      const warehouseBreakdown = Array.from(warehouseMap.entries())
        .map(([warehouse, data]) => ({
          warehouse,
          value: data.value,
          units: data.units,
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

      return {
        totalValue,
        totalUnits,
        averageCost,
        categoryBreakdown,
        warehouseBreakdown,
      } as ValuationData;
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });

  const handleExport = async () => {
    if (!valuationData) return;

    setIsExporting(true);
    try {
      const csvLines = [
        "Inventory Valuation Report",
        `Generated: ${new Date().toLocaleString()}`,
        "",
        "Summary",
        `Total Value,${formatCurrency(valuationData.totalValue)}`,
        `Total Units,${valuationData.totalUnits.toFixed(2)}`,
        `Average Cost/Unit,${formatCurrency(valuationData.averageCost)}`,
        "",
        "Category Breakdown",
        "Category,Value,Units,Percentage",
        ...valuationData.categoryBreakdown.map(
          (item) => `${item.category},${formatCurrency(item.value)},${item.units.toFixed(2)},${item.percentage.toFixed(1)}%`
        ),
        "",
        "Warehouse Breakdown",
        "Warehouse,Value,Units,Percentage",
        ...valuationData.warehouseBreakdown.map(
          (item) => `${item.warehouse},${formatCurrency(item.value)},${item.units.toFixed(2)},${item.percentage.toFixed(1)}%`
        ),
      ];

      const csv = csvLines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-valuation-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Valuation report exported");
      logger.info("Exported valuation report");
    } catch (error) {
      logger.error("Failed to export valuation report", error);
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </Card>
    );
  }

  if (!valuationData) return null;

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Inventory Valuation Report
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Current inventory value and breakdown
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 border-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Value</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono">
            {formatCurrency(valuationData.totalValue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">at cost</div>
        </Card>

        <Card className="p-4 border-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Units</span>
            <Package className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono">
            {valuationData.totalUnits.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">lbs</div>
        </Card>

        <Card className="p-4 border-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Avg Cost/Unit</span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono">
            {formatCurrency(valuationData.averageCost)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">per lb</div>
        </Card>
      </div>

      {/* Category Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3">Breakdown by Category</h4>
        <div className="space-y-2">
          {valuationData.categoryBreakdown.map((item) => (
            <div key={item.category} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{item.category}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(item.value)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {item.percentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warehouse Breakdown */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Breakdown by Warehouse</h4>
        <div className="space-y-2">
          {valuationData.warehouseBreakdown.map((item) => (
            <div key={item.warehouse} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{item.warehouse}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(item.value)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {item.percentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
