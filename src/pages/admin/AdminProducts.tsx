import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, ArrowUpDown, Grid, List, Table as TableIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProductCard } from "@/components/admin/ProductCard";
import { InlineProductEdit } from "@/components/admin/InlineProductEdit";
import { ProductTableView } from "@/components/admin/ProductTableView";
import { EnhancedBulkActions } from "@/components/admin/EnhancedBulkActions";
import { AdvancedProductFilters } from "@/components/admin/AdvancedProductFilters";
import { ColumnVisibilityControl } from "@/components/admin/ColumnVisibilityControl";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "recent" | "stock-asc";

export default function AdminProducts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "table">("list");
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "image", "name", "price", "stock", "status"
  ]);
  const [advancedFilters, setAdvancedFilters] = useState<any>({
    category: [],
    strainType: [],
    priceRange: [0, 1000],
    stockRange: [0, 1000],
    inStock: null,
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const availableColumns = [
    { id: "image", label: "Image" },
    { id: "name", label: "Name" },
    { id: "price", label: "Price" },
    { id: "stock", label: "Stock" },
    { id: "status", label: "Status" },
  ];

  // Set up realtime subscription for products with proper error handling
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout;
    let isSubscribing = false;

    const setupSubscription = () => {
      if (isSubscribing) return;
      
      isSubscribing = true;
      
      // Wait a bit before subscribing to ensure connection is ready
      setTimeout(() => {
        try {
          channel = supabase
            .channel('products-realtime', {
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
                try {
                  console.log('Product update received:', payload.eventType);
                  queryClient.invalidateQueries({ queryKey: ['admin-products'] });
                } catch (error) {
                  console.error('Error processing product update:', error);
                }
              }
            )
            .subscribe((status) => {
              isSubscribing = false;
              
              if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to products realtime');
              } else if (status === 'CHANNEL_ERROR') {
                console.error('Failed to subscribe to products channel, retrying in 5s...');
                retryTimeout = setTimeout(setupSubscription, 5000);
              } else if (status === 'TIMED_OUT') {
                console.error('Products subscription timed out, retrying...');
                retryTimeout = setTimeout(setupSubscription, 3000);
              }
            });
        } catch (error) {
          console.error('Error setting up products subscription:', error);
          isSubscribing = false;
          retryTimeout = setTimeout(setupSubscription, 5000);
        }
      }, 500);
    };

    setupSubscription();

    return () => {
      clearTimeout(retryTimeout);
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, [queryClient]);

  const { data: products, isLoading } = useQuery({
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

  const toggleProductStatus = useMutation({
    mutationFn: async ({ id, in_stock }: { id: string; in_stock: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ in_stock: !in_stock })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: "✓ Product status updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: "✓ Product updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update product",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const bulkUpdateProducts = useMutation({
    mutationFn: async (updates: any) => {
      for (const id of selectedProducts) {
        const { error } = await supabase
          .from("products")
          .update(updates)
          .eq("id", id);
        
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: `✓ Updated ${selectedProducts.length} products` });
      setSelectedProducts([]);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update products",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const bulkDeleteProducts = useMutation({
    mutationFn: async () => {
      for (const id of selectedProducts) {
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", id);
        
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: `✓ Deleted ${selectedProducts.length} products` });
      setSelectedProducts([]);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete products",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: "✓ Product deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete product",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Filter and sort products
  const filteredProducts = products?.filter((product) => {
    const matchesSearch = (product.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.strain_type || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "in-stock" && product.in_stock) ||
      (stockFilter === "out-of-stock" && !product.in_stock);

    // Advanced filters
    const matchesAdvCategory = advancedFilters.category.length === 0 ||
      advancedFilters.category.includes(product.category || 'uncategorized');
    
    const matchesAdvStrain = advancedFilters.strainType.length === 0 ||
      advancedFilters.strainType.includes(product.strain_type || 'unknown');
    
    const matchesAdvPrice = (product.price || 0) >= advancedFilters.priceRange[0] &&
      (product.price || 0) <= advancedFilters.priceRange[1];
    
    const matchesAdvStock = (product.stock_quantity || 0) >= advancedFilters.stockRange[0] &&
      (product.stock_quantity || 0) <= advancedFilters.stockRange[1];
    
    const matchesAdvInStock = advancedFilters.inStock === null ||
      (advancedFilters.inStock && product.in_stock);
    
    return matchesSearch && matchesCategory && matchesStock &&
      matchesAdvCategory && matchesAdvStrain && matchesAdvPrice &&
      matchesAdvStock && matchesAdvInStock;
  }).sort((a, b) => {
    switch (sortBy) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "price-asc":
        return (a.price || 0) - (b.price || 0);
      case "price-desc":
        return (b.price || 0) - (a.price || 0);
      case "stock-asc":
        return (a.stock_quantity || 0) - (b.stock_quantity || 0);
      case "recent":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  const toggleProductSelection = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedProducts.length === filteredProducts?.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts?.map((p) => p.id) || []);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-muted-foreground">
            {products?.length || 0} total products
          </p>
        </div>
        <Button onClick={() => navigate("/admin/products/new")} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Add New Product
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, strains, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Category" />
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
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently Added</SelectItem>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="price-asc">Price (Low to High)</SelectItem>
            <SelectItem value="price-desc">Price (High to Low)</SelectItem>
            <SelectItem value="stock-asc">Stock (Low to High)</SelectItem>
          </SelectContent>
        </Select>

        <AdvancedProductFilters
          activeFilters={advancedFilters}
          onFilterChange={setAdvancedFilters}
        />

        <ColumnVisibilityControl
          visibleColumns={visibleColumns}
          onToggleColumn={(col) => {
            setVisibleColumns((prev) =>
              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
            );
          }}
          availableColumns={availableColumns}
        />

        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
          <TabsList>
            <TabsTrigger value="list">
              <List className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableIcon className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="grid">
              <Grid className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <EnhancedBulkActions
          selectedCount={selectedProducts.length}
          selectedProducts={selectedProducts}
          products={products || []}
          onBulkUpdate={async (updates) => {
            await bulkUpdateProducts.mutateAsync(updates);
          }}
          onIndividualUpdate={async (id, updates) => {
            await updateProduct.mutateAsync({ id, updates });
          }}
          onBulkDelete={() => bulkDeleteProducts.mutate()}
          onClearSelection={() => setSelectedProducts([])}
        />
      )}

      {/* Products Display */}
      {isLoading ? (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {filteredProducts && filteredProducts.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedProducts.length === filteredProducts.length}
                  onChange={selectAll}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm text-muted-foreground">
                  Select All ({filteredProducts.length})
                </span>
              </div>

              {viewMode === "table" ? (
                <ProductTableView
                  products={filteredProducts}
                  selectedProducts={selectedProducts}
                  onToggleSelect={toggleProductSelection}
                  onSelectAll={selectAll}
                  onUpdate={(id, updates) => updateProduct.mutate({ id, updates })}
                  onDelete={(id) => {
                    if (confirm("Are you sure you want to delete this product?")) {
                      deleteProduct.mutate(id);
                    }
                  }}
                  onEdit={(id) => navigate(`/admin/products/${id}/edit`)}
                  onDuplicate={(id) => navigate(`/admin/products/${id}/duplicate`)}
                  visibleColumns={visibleColumns}
                />
              ) : viewMode === "list" ? (
                <div className="space-y-3">
                  {filteredProducts.map((product) => (
                    <InlineProductEdit
                      key={product.id}
                      product={product}
                      isSelected={selectedProducts.includes(product.id)}
                      onToggleSelect={() => toggleProductSelection(product.id)}
                      onUpdate={(id, updates) => updateProduct.mutate({ id, updates })}
                      onDelete={(id) => {
                        if (confirm("Are you sure you want to delete this product?")) {
                          deleteProduct.mutate(id);
                        }
                      }}
                      onEdit={(id) => navigate(`/admin/products/${id}/edit`)}
                      onDuplicate={(id) => navigate(`/admin/products/${id}/duplicate`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isSelected={selectedProducts.includes(product.id)}
                      onToggleSelect={() => toggleProductSelection(product.id)}
                      onToggleStatus={() =>
                        toggleProductStatus.mutate({
                          id: product.id,
                          in_stock: product.in_stock,
                        })
                      }
                      onDelete={() => {
                        if (confirm("Are you sure you want to delete this product?")) {
                          deleteProduct.mutate(product.id);
                        }
                      }}
                      onEdit={() => navigate(`/admin/products/${product.id}/edit`)}
                      onDuplicate={() => navigate(`/admin/products/${product.id}/duplicate`)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No products found</p>
              <Button
                onClick={() => navigate("/admin/products/new")}
                className="mt-4"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Product
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
