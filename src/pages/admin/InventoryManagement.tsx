import { useState, useMemo, useEffect } from "react";
import { logger } from "@/lib/logger";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, ArrowUpDown, Settings, AlertTriangle, CheckCircle, Warehouse, Layers } from "lucide-react";
import { StockAdjustmentDialog } from "@/components/admin/StockAdjustmentDialog";
import { BulkInventoryModal } from "@/components/admin/BulkInventoryModal";
import { InventoryMovementLog } from "@/components/admin/InventoryMovementLog";
import { BulkImageGenerator } from "@/components/admin/products/BulkImageGenerator";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { inventoryTutorial } from "@/lib/tutorials/tutorialConfig";
import { formatCurrency, formatQuantity } from '@/lib/formatters';


interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  batch_number: string;
  available_quantity: number;
  low_stock_alert: number;
  warehouse_location?: string;
  category: string;
  cost_per_unit?: number | null;
  wholesale_price?: number | null;
  price_per_lb?: number | null;
}

export function InventoryManagement() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, _setSearchTerm] = useState("");

  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    async function loadInventory() {
      if (!tenant?.id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, tenant_id, name, sku, batch_number, available_quantity, low_stock_alert, category, cost_per_unit, wholesale_price, price_per_lb')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (error) throw error;
        // Map data to include warehouse_location as empty string for compatibility
        setProducts(((data || []) as Array<Record<string, unknown>>).map(p => ({ ...p, warehouse_location: '' })) as Product[]);
      } catch (error) {
        logger.error('Error loading inventory', error, { component: 'InventoryManagement' });
        toast.error("Failed to load inventory");
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [tenant?.id]);

  // Memoize grouped inventory to prevent recalculation
  const groupedInventory = useMemo(() => {
    return products.reduce((acc, item) => {
      const warehouse = item.warehouse_location || "Warehouse A";
      if (!acc[warehouse]) {
        acc[warehouse] = [];
      }
      acc[warehouse].push(item);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [products]);

  const _filteredProducts = products.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower) ||
      p.batch_number?.toLowerCase().includes(searchLower)
    );
  });

  const totalStock = products.reduce((sum, item) => sum + Number(item.available_quantity || 0), 0);

  // Calculate total value from actual product costs (cost_per_unit, wholesale_price, or price_per_lb)
  const totalValue = products.reduce((sum, item) => {
    const cost = item.cost_per_unit ?? item.wholesale_price ?? item.price_per_lb ?? 0;
    const quantity = Number(item.available_quantity || 0);
    return sum + (quantity * cost);
  }, 0);

  // Calculate average cost per lb for display (only from products that have costs)
  const productsWithCosts = products.filter(item =>
    (item.cost_per_unit ?? item.wholesale_price ?? item.price_per_lb ?? 0) > 0
  );
  const avgCostPerLb = productsWithCosts.length > 0 && totalStock > 0
    ? totalValue / totalStock
    : 0;

  const getStockStatus = (qty: number, reorderPoint: number = 20) => {
    if (qty <= 10) return { status: "critical", color: "destructive", label: "CRITICAL" };
    if (qty <= reorderPoint) return { status: "low", color: "warning", label: "LOW" };
    return { status: "good", color: "default", label: "GOOD" };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="h-3 w-3 mr-1" />;
      case 'low': return <ArrowUpDown className="h-3 w-3 mr-1" />;
      default: return <CheckCircle className="h-3 w-3 mr-1" />;
    }
  };

  // Get the unit cost for a product (prioritize cost_per_unit, then wholesale_price, then price_per_lb)
  const getProductCost = (item: Product): number => {
    return item.cost_per_unit ?? item.wholesale_price ?? item.price_per_lb ?? 0;
  };

  // Calculate total value for a single product
  const getProductTotalValue = (item: Product): number => {
    const cost = getProductCost(item);
    const quantity = Number(item.available_quantity || 0);
    return quantity * cost;
  };

  const columns: ResponsiveColumn<Product>[] = [
    {
      header: 'Product',
      accessorKey: 'name',
      cell: (item) => <div className="font-medium truncate max-w-[150px] sm:max-w-none">{item.name}</div>
    },
    {
      header: 'Weight',
      accessorKey: 'available_quantity',
      className: 'text-right',
      cell: (item) => <div className="font-mono">{formatQuantity(Number(item.available_quantity || 0), 'lbs', { showZero: true })}</div>
    },
    {
      header: 'Cost/lb',
      className: 'text-right',
      cell: (item) => {
        const cost = getProductCost(item);
        return <div className="font-mono">{cost > 0 ? formatCurrency(cost) : '—'}</div>;
      }
    },
    {
      header: 'Total Value',
      className: 'text-right',
      cell: (item) => {
        const value = getProductTotalValue(item);
        return <div className="font-mono">{value > 0 ? formatCurrency(value) : '—'}</div>;
      }
    },
    {
      header: 'Status',
      className: 'text-center',
      cell: (item) => {
        const status = getStockStatus(Number(item.available_quantity || 0), item.low_stock_alert);
        const badgeVariant = status.color === 'warning' ? 'secondary' : (status.color as "destructive" | "default");
        return (
          <Badge variant={badgeVariant} className="inline-flex items-center">
            {getStatusIcon(status.status)}
            {status.label}
          </Badge>
        );
      }
    },
    {
      header: 'Actions',
      className: 'text-center',
      cell: (item) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedProduct(item);
            setAdjustmentDialogOpen(true);
          }}
        >
          <Settings className="h-4 w-4" />
          <span className="sr-only">Adjust</span>
        </Button>
      )
    }
  ];

  const renderMobileCard = (item: Product) => {
    const status = getStockStatus(Number(item.available_quantity || 0), item.low_stock_alert);
    const productValue = getProductTotalValue(item);

    return (
      <div className="space-y-3">
      <div className="flex items-start justify-between">
          <div className="font-medium text-base">{item.name}</div>
          {(() => {
            const badgeVariant = status.color === 'warning' ? 'secondary' : (status.color as "destructive" | "default");
            return <Badge variant={badgeVariant} className="flex-shrink-0">{status.label}</Badge>;
          })()}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs">Weight</span>
            <span className="font-mono font-medium">{formatQuantity(Number(item.available_quantity || 0), 'lbs')}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Total Value</span>
            <span className="font-mono font-medium">{productValue > 0 ? formatCurrency(productValue) : '—'}</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2"
          onClick={() => {
            setSelectedProduct(item);
            setAdjustmentDialogOpen(true);
          }}
        >
          <Settings className="h-4 w-4 mr-2" />
          Adjust Levels
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"><Warehouse className="h-6 w-6" /> Inventory Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Wholesale scale inventory across multiple warehouses</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {selectedProductIds.size > 0 && (
            <Button
              variant="outline"
              className="min-h-[44px] touch-manipulation text-sm sm:text-base"
              onClick={() => setBulkModalOpen(true)}
            >
              <Layers className="h-4 w-4 mr-2" />
              Bulk Adjust ({selectedProductIds.size})
            </Button>
          )}
          <BulkImageGenerator products={products} />
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation flex-1 sm:flex-initial text-sm sm:text-base min-w-[100px]"
            data-tutorial="add-product"
            onClick={() => {
              navigateToAdmin('inventory/products');
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
      {loading ? (
        <Card className="p-8 text-center">
          <Package className="h-10 w-10 animate-bounce text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading inventory...</p>
        </Card>
      ) : Object.keys(groupedInventory).length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No inventory data. Add products to get started.</p>
        </Card>
      ) : (
        Object.entries(groupedInventory).map(([warehouseName, warehouseProducts]) => {
          // Calculate warehouse totals using actual product costs
          const warehouseTotal = warehouseProducts.reduce((sum, p) => sum + Number(p.available_quantity || 0), 0);
          const warehouseValue = warehouseProducts.reduce((sum, p) => sum + getProductTotalValue(p), 0);
          const capacity = 500; // Default capacity

          return (
            <Card key={warehouseName} className="p-3 sm:p-4 md:p-6 overflow-hidden">
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

              <ResponsiveTable
                columns={columns}
                data={warehouseProducts}
                isLoading={false}
                mobileRenderer={renderMobileCard}
                keyExtractor={(item) => item.id}
                className="mt-4"
              />
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
          productName={selectedProduct.name}
          currentQuantity={Number(selectedProduct.available_quantity || 0)}
          warehouse={selectedProduct.warehouse_location || "Warehouse A"}
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
        />
      )}

      <BulkInventoryModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        selectedProducts={Array.from(selectedProductIds).map(id => products.find(p => p.id === id)).filter(Boolean) as Product[]}
        onComplete={() => { setSelectedProductIds(new Set()); setBulkModalOpen(false); }}
      />
    </div>
  );
}
