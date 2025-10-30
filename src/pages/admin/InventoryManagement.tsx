import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, TrendingDown, RefreshCcw, Plus, Minus, Edit, ChevronDown, Search, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InventoryManagement() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [quickAdjustMode, setQuickAdjustMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Setup realtime subscription with proper cleanup
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupChannel = async () => {
      channel = supabase
        .channel('inventory-changes', {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products'
          },
          (payload) => {
            console.log('Inventory updated:', payload);
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to inventory channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, [queryClient]);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) return;
      
      const newStock = Math.max(0, (selectedProduct.stock_quantity || 0) + adjustAmount);
      const { error } = await supabase
        .from("products")
        .update({ 
          stock_quantity: newStock,
          in_stock: newStock > 0 
        })
        .eq("id", selectedProduct.id);

      if (error) throw error;
      return { newStock };
    },
    onSuccess: async (data) => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ 
        title: "✓ Stock updated",
        description: `New stock level: ${data?.newStock || 0} units` 
      });
      setSelectedProduct(null);
      setAdjustAmount(0);
      setAdjustReason("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update stock",
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Filter products
  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && (p.stock_quantity || 0) < 10 && (p.stock_quantity || 0) > 0) ||
      (stockFilter === "out" && (p.stock_quantity || 0) === 0) ||
      (stockFilter === "in" && (p.stock_quantity || 0) >= 10);
    return matchesSearch && matchesCategory && matchesStock;
  }) || [];

  const lowStockProducts = products?.filter((p) => (p.stock_quantity || 0) < 10 && (p.stock_quantity || 0) > 0) || [];
  const outOfStockProducts = products?.filter((p) => !p.in_stock || (p.stock_quantity || 0) === 0) || [];
  const totalInventoryValue = products?.reduce((sum, p) => sum + (p.price || 0) * (p.stock_quantity || 0), 0) || 0;

  const quickAdjust = useMutation({
    mutationFn: async ({ productId, amount }: { productId: string; amount: number }) => {
      const product = products?.find(p => p.id === productId);
      if (!product) return;
      
      const newStock = Math.max(0, (product.stock_quantity || 0) + amount);
      const { error } = await supabase
        .from("products")
        .update({ 
          stock_quantity: newStock,
          in_stock: newStock > 0 
        })
        .eq("id", productId);

      if (error) throw error;
      return { productId, newStock };
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: "✓ Stock updated" });
    },
  });

  const exportInventory = () => {
    const csv = [
      ["Product Name", "Category", "Stock", "Value", "Status"].join(","),
      ...(products || []).map(p => [
        `"${p.name}"`,
        p.category,
        p.stock_quantity || 0,
        ((p.stock_quantity || 0) * (p.price || 0)).toFixed(2),
        (p.stock_quantity || 0) > 0 ? "In Stock" : "Out of Stock"
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast({ title: "✓ Inventory exported" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage product stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportInventory}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.refetchQueries({ queryKey: ["admin-products"] })}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-3xl font-bold">{products?.length || 0}</p>
            </div>
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Stock</p>
              <p className="text-3xl font-bold">
                {products?.filter((p) => p.in_stock && (p.stock_quantity || 0) > 0).length || 0}
              </p>
            </div>
            <Package className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-3xl font-bold text-yellow-600">{lowStockProducts.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className="text-3xl font-bold text-red-600">{outOfStockProducts.length}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="flower">Flower</SelectItem>
            <SelectItem value="pre-rolls">Pre-Rolls</SelectItem>
            <SelectItem value="edibles">Edibles</SelectItem>
            <SelectItem value="vapes">Vapes</SelectItem>
            <SelectItem value="concentrates">Concentrates</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock Levels</SelectItem>
            <SelectItem value="in">In Stock (10+)</SelectItem>
            <SelectItem value="low">Low Stock (1-9)</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Value */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-2">Total Inventory Value</h2>
        <p className="text-4xl font-bold text-green-600">${totalInventoryValue.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground mt-1">Based on retail prices • {products?.length || 0} products</p>
      </Card>

      {/* All Products Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">All Products</h2>
          <Button
            variant={quickAdjustMode ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickAdjustMode(!quickAdjustMode)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {quickAdjustMode ? "Exit Quick Edit" : "Quick Adjust"}
          </Button>
        </div>

        <div className="space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No products found matching your filters
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div 
                key={product.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="h-16 w-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{product.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline">{product.category}</Badge>
                      <span className="text-sm text-muted-foreground">
                        ${product.price}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-center min-w-[100px]">
                    <p className={`text-2xl font-bold ${
                      (product.stock_quantity || 0) === 0 ? "text-red-600" :
                      (product.stock_quantity || 0) < 10 ? "text-yellow-600" :
                      "text-green-600"
                    }`}>
                      {product.stock_quantity || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">units</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {quickAdjustMode ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickAdjust.mutate({ productId: product.id, amount: -10 })}
                        disabled={quickAdjust.isPending}
                      >
                        -10
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickAdjust.mutate({ productId: product.id, amount: -1 })}
                        disabled={quickAdjust.isPending}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickAdjust.mutate({ productId: product.id, amount: 1 })}
                        disabled={quickAdjust.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickAdjust.mutate({ productId: product.id, amount: 10 })}
                        disabled={quickAdjust.isPending}
                      >
                        +10
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setSelectedProduct(product)}
                      variant="outline"
                      size="sm"
                    >
                      Adjust Stock
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Current Stock</Label>
              <p className="text-2xl font-bold">{selectedProduct?.stock_quantity || 0} units</p>
            </div>

            <div>
              <Label htmlFor="adjust">Adjustment Amount</Label>
              <Input
                id="adjust"
                type="number"
                value={adjustAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setAdjustAmount(val);
                }}
                placeholder="Enter positive to add, negative to remove"
                className="mt-1.5"
              />
              {adjustAmount !== 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  New stock: {Math.max(0, (selectedProduct?.stock_quantity || 0) + adjustAmount)} units
                  {(selectedProduct?.stock_quantity || 0) + adjustAmount < 0 && (
                    <span className="text-red-600"> (Cannot go below 0)</span>
                  )}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Restock, Damaged, Returned"
                className="mt-1.5"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setSelectedProduct(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => adjustStock.mutate()} 
                className="flex-1"
                disabled={adjustStock.isPending || adjustAmount === 0 || (selectedProduct?.stock_quantity || 0) + adjustAmount < 0}
              >
                {adjustStock.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
