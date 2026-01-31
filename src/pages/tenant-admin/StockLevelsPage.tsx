import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useDebounce } from "@/hooks/useDebounce";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import { formatCurrency, formatQuantity } from "@/lib/formatters";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";

interface StockProduct {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  available_quantity: number;
  low_stock_alert: number;
  cost_per_unit: number | null;
  wholesale_price: number | null;
  retail_price: number | null;
}

type SortField = "name" | "sku" | "category" | "available_quantity" | "value" | "status";
type SortOrder = "asc" | "desc";

const getStockStatus = (qty: number, threshold: number = 10) => {
  if (qty <= 0) return { status: "out_of_stock", color: "destructive" as const, label: "OUT OF STOCK" };
  if (qty <= threshold * 0.5) return { status: "critical", color: "destructive" as const, label: "CRITICAL" };
  if (qty <= threshold) return { status: "low", color: "secondary" as const, label: "LOW" };
  return { status: "good", color: "default" as const, label: "IN STOCK" };
};

const getStatusPriority = (status: string): number => {
  switch (status) {
    case "out_of_stock": return 0;
    case "critical": return 1;
    case "low": return 2;
    case "good": return 3;
    default: return 4;
  }
};

export default function StockLevelsPage() {
  const { tenant } = useTenantAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Table preferences with persistence
  const { preferences, savePreferences } = useTablePreferences("stock-levels", {
    sortBy: "available_quantity",
    sortOrder: "asc",
    customFilters: { category: "all" },
  });

  const [sortField, setSortField] = useState<SortField>(
    (preferences.sortBy as SortField) || "available_quantity"
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    preferences.sortOrder || "asc"
  );

  // Fetch products for stock levels
  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.inventory.list(),
    queryFn: async (): Promise<StockProduct[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, sku, category, available_quantity, low_stock_alert, cost_per_unit, wholesale_price, retail_price"
        )
        .eq("tenant_id", tenant.id)
        .order("name");

      if (error) {
        logger.error("Error fetching stock levels", error, {
          component: "StockLevelsPage",
        });
        throw error;
      }

      return (data || []).map((p) => ({
        ...p,
        available_quantity: p.available_quantity ?? 0,
        low_stock_alert: p.low_stock_alert ?? 10,
      }));
    },
    enabled: !!tenant?.id,
  });

  // Get unique categories for filter
  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    ) as string[];
  }, [products]);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    let newOrder: SortOrder = "asc";
    if (sortField === field) {
      newOrder = sortOrder === "asc" ? "desc" : "asc";
    }
    setSortField(field);
    setSortOrder(newOrder);
    savePreferences({ sortBy: field, sortOrder: newOrder });
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();

    return products
      .filter((p) => {
        // Search filter
        const matchesSearch =
          !searchLower ||
          p.name?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower) ||
          p.category?.toLowerCase().includes(searchLower);

        // Category filter
        const matchesCategory =
          categoryFilter === "all" || p.category === categoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case "name":
            comparison = (a.name || "").localeCompare(b.name || "");
            break;
          case "sku":
            comparison = (a.sku || "").localeCompare(b.sku || "");
            break;
          case "category":
            comparison = (a.category || "").localeCompare(b.category || "");
            break;
          case "available_quantity":
            comparison = a.available_quantity - b.available_quantity;
            break;
          case "value": {
            const valueA = a.available_quantity * (a.cost_per_unit || a.wholesale_price || 0);
            const valueB = b.available_quantity * (b.cost_per_unit || b.wholesale_price || 0);
            comparison = valueA - valueB;
            break;
          }
          case "status": {
            const statusA = getStockStatus(a.available_quantity, a.low_stock_alert);
            const statusB = getStockStatus(b.available_quantity, b.low_stock_alert);
            comparison = getStatusPriority(statusA.status) - getStatusPriority(statusB.status);
            break;
          }
          default:
            comparison = 0;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [products, debouncedSearch, categoryFilter, sortField, sortOrder]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce(
      (sum, p) => sum + p.available_quantity,
      0
    );
    const totalValue = products.reduce((sum, p) => {
      const cost = p.cost_per_unit || p.wholesale_price || 0;
      return sum + p.available_quantity * cost;
    }, 0);

    const outOfStock = products.filter(
      (p) => p.available_quantity <= 0
    ).length;
    const lowStock = products.filter((p) => {
      const status = getStockStatus(p.available_quantity, p.low_stock_alert);
      return status.status === "low" || status.status === "critical";
    }).length;

    return { totalProducts, totalStock, totalValue, outOfStock, lowStock };
  }, [products]);

  // Sortable column header component
  const SortableHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => {
    const isActive = sortField === field;
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`-ml-3 h-8 hover:bg-transparent ${className}`}
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : (
            <ArrowDown className="ml-2 h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    );
  };

  // Table columns definition
  const columns: ResponsiveColumn<StockProduct>[] = [
    {
      header: <SortableHeader field="name" label="Product" />,
      accessorKey: "name",
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-medium truncate max-w-[200px]">{item.name}</span>
          {item.sku && (
            <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
          )}
        </div>
      ),
    },
    {
      header: <SortableHeader field="category" label="Category" />,
      accessorKey: "category",
      cell: (item) => (
        <Badge variant="outline" className="capitalize">
          {item.category || "Uncategorized"}
        </Badge>
      ),
    },
    {
      header: <SortableHeader field="available_quantity" label="Stock" className="justify-end" />,
      className: "text-right",
      cell: (item) => (
        <div className="font-mono text-right">
          {formatQuantity(item.available_quantity, "units")}
        </div>
      ),
    },
    {
      header: <SortableHeader field="value" label="Value" className="justify-end" />,
      className: "text-right",
      cell: (item) => {
        const cost = item.cost_per_unit || item.wholesale_price || 0;
        const value = item.available_quantity * cost;
        return (
          <div className="font-mono text-right">
            {value > 0 ? formatCurrency(value) : "—"}
          </div>
        );
      },
    },
    {
      header: <SortableHeader field="status" label="Status" />,
      className: "text-center",
      cell: (item) => {
        const status = getStockStatus(item.available_quantity, item.low_stock_alert);
        return (
          <Badge variant={status.color} className="whitespace-nowrap">
            {status.label}
          </Badge>
        );
      },
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (item: StockProduct) => {
    const status = getStockStatus(item.available_quantity, item.low_stock_alert);
    const cost = item.cost_per_unit || item.wholesale_price || 0;
    const value = item.available_quantity * cost;

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{item.name}</div>
            {item.sku && (
              <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
            )}
          </div>
          <Badge variant={status.color} className="flex-shrink-0 ml-2">
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs">Category</span>
            <span className="capitalize">{item.category || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Stock</span>
            <span className="font-mono">{item.available_quantity}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Value</span>
            <span className="font-mono">{value > 0 ? formatCurrency(value) : "—"}</span>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7" />
            Stock Levels
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage inventory stock levels across all products
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Total Products
            </span>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono">
            {stats.totalProducts}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Total Stock
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono">
            {formatQuantity(stats.totalStock, "units")}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Total Value
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono">
            {formatCurrency(stats.totalValue)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Low Stock Items
            </span>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono">
            {stats.lowStock}
            {stats.outOfStock > 0 && (
              <span className="text-sm text-destructive ml-2">
                ({stats.outOfStock} out)
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, SKU, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            savePreferences({
              customFilters: { ...preferences.customFilters, category: value },
            });
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stock Table */}
      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          mobileRenderer={renderMobileCard}
          emptyState={{
            type: "no_products",
            title: searchTerm || categoryFilter !== "all"
              ? "No products found"
              : "No products yet",
            description: searchTerm || categoryFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Add products to see stock levels here",
          }}
        />
      </Card>
    </div>
  );
}
