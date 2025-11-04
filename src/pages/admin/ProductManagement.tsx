import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Barcode,
  DollarSign,
  LayoutGrid,
  List,
  Filter,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipGuide } from '@/components/shared/TooltipGuide';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ProductCard } from "@/components/admin/ProductCard";
import { Toggle } from "@/components/ui/toggle";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductManagement() {
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    brand: "",
    strain_name: "",
    thc_percent: "",
    cbd_percent: "",
    batch_number: "",
    cost_per_unit: "",
    wholesale_price: "",
    retail_price: "",
    available_quantity: "",
  });

  useEffect(() => {
    if (tenant && !tenantLoading) {
      loadProducts();
    } else if (!tenantLoading && !tenant) {
      setLoading(false);
    }
  }, [tenant, tenantLoading]);

  const loadProducts = async () => {
    if (!tenant?.id) return;
    
    try {
      setLoading(true);
      // Load all products - tenant filtering will be added when products table has tenant_id column
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error("Failed to load products: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const productData = {
        name: formData.name,
        sku: formData.sku || null,
        category: formData.category || "Uncategorized",
        brand: formData.brand || null,
        strain_name: formData.strain_name || null,
        thc_percent: formData.thc_percent ? parseFloat(formData.thc_percent) : null,
        cbd_percent: formData.cbd_percent ? parseFloat(formData.cbd_percent) : null,
        batch_number: formData.batch_number || null,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        retail_price: formData.retail_price ? parseFloat(formData.retail_price) : null,
        price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : 0,
        thca_percentage: formData.thc_percent ? parseFloat(formData.thc_percent) : null,
        available_quantity: formData.available_quantity ? parseInt(formData.available_quantity) : 0,
        total_quantity: formData.available_quantity ? parseInt(formData.available_quantity) : 0,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        // Check tenant limits before creating
        if (tenant?.limits?.products !== undefined) {
          const currentProducts = tenant.usage?.products || 0;
          const productLimit = tenant.limits.products;
          
          // -1 means unlimited, so skip check
          if (productLimit !== -1 && productLimit > 0 && currentProducts >= productLimit) {
            toast.error('Product limit reached', {
              description: `You've reached your product limit (${currentProducts}/${productLimit}). Please upgrade your plan.`,
            });
            return;
          }
        }

        const { error } = await supabase
          .from("products")
          .insert([productData]);

        if (error) throw error;
        toast.success("Product created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (error: any) {
      toast.error("Failed to save product: " + error.message);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      sku: product.sku || "",
      category: product.category || "",
      brand: product.brand || "",
      strain_name: product.strain_name || "",
      thc_percent: product.thc_percent?.toString() || "",
      cbd_percent: product.cbd_percent?.toString() || "",
      batch_number: product.batch_number || "",
      cost_per_unit: product.cost_per_unit?.toString() || "",
      wholesale_price: product.wholesale_price?.toString() || "",
      retail_price: product.retail_price?.toString() || "",
      available_quantity: product.available_quantity?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast.success("Product deleted");
      loadProducts();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category: "",
      brand: "",
      strain_name: "",
      thc_percent: "",
      cbd_percent: "",
      batch_number: "",
      cost_per_unit: "",
      wholesale_price: "",
      retail_price: "",
      available_quantity: "",
    });
    setEditingProduct(null);
  };

  const filteredProducts = products
    .filter(
      (p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "price":
          return (b.wholesale_price || 0) - (a.wholesale_price || 0);
        case "stock":
          return (b.available_quantity || 0) - (a.available_quantity || 0);
        case "margin":
          const marginA = profitMargin(a.cost_per_unit, a.wholesale_price);
          const marginB = profitMargin(b.cost_per_unit, b.wholesale_price);
          return Number(marginB) - Number(marginA);
        default:
          return 0;
      }
    });

  const profitMargin = (cost: number, price: number) => {
    if (!cost || !price) return 0;
    return (((price - cost) / price) * 100).toFixed(1);
  };

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  );

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Product Management</h1>
            {tenant?.id && (
              <TooltipGuide
                title="💡 Product Management"
                content="Upload CSV to add 100+ products instantly. Products can be organized by category and tracked by batch numbers."
                placement="right"
                tenantId={tenant.id}
              />
            )}
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage products, batches, and inventory packages
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={() => navigate("/admin/inventory/barcodes")}>
            <Barcode className="h-4 w-4 mr-2" />
            Generate Barcodes
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Blue Dream 1/8oz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="Flower, Concentrate, Edible..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Strain Name</Label>
                    <Input
                      value={formData.strain_name}
                      onChange={(e) =>
                        setFormData({ ...formData, strain_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Batch Number</Label>
                    <Input
                      value={formData.batch_number}
                      onChange={(e) =>
                        setFormData({ ...formData, batch_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>THC %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.thc_percent}
                      onChange={(e) =>
                        setFormData({ ...formData, thc_percent: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CBD %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.cbd_percent}
                      onChange={(e) =>
                        setFormData({ ...formData, cbd_percent: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost per Unit *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={formData.cost_per_unit}
                      onChange={(e) =>
                        setFormData({ ...formData, cost_per_unit: e.target.value })
                      }
                      placeholder="25.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wholesale Price *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={formData.wholesale_price}
                      onChange={(e) =>
                        setFormData({ ...formData, wholesale_price: e.target.value })
                      }
                      placeholder="35.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retail Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.retail_price}
                      onChange={(e) =>
                        setFormData({ ...formData, retail_price: e.target.value })
                      }
                      placeholder="45.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Initial Quantity</Label>
                    <Input
                      type="number"
                      value={formData.available_quantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          available_quantity: e.target.value,
                        })
                      }
                      placeholder="50"
                    />
                  </div>
                </div>

                {formData.cost_per_unit && formData.wholesale_price && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">
                      💰 Profit Margin:{" "}
                      {profitMargin(
                        parseFloat(formData.cost_per_unit),
                        parseFloat(formData.wholesale_price)
                      )}
                      % ($
                      {(
                        parseFloat(formData.wholesale_price || "0") -
                        parseFloat(formData.cost_per_unit || "0")
                      ).toFixed(2)}{" "}
                      per unit)
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingProduct ? "Update" : "Create"} Product
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {products.reduce((sum, p) => sum + (p.available_quantity || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Available Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {products.reduce((sum, p) => sum + (p.fronted_quantity || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Fronted Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  $
                  {products
                    .reduce(
                      (sum, p) =>
                        sum +
                        (p.available_quantity || 0) * (p.wholesale_price || 0),
                      0
                    )
                    .toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
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
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="price">Price (High-Low)</SelectItem>
            <SelectItem value="stock">Stock (High-Low)</SelectItem>
            <SelectItem value="margin">Margin (High-Low)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-md overflow-hidden">
          <Toggle
            pressed={viewMode === "grid"}
            onPressedChange={() => setViewMode("grid")}
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === "list"}
            onPressedChange={() => setViewMode("list")}
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none border-l"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>
      </div>

      {/* Products Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Wholesale</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.strain_name && (
                            <p className="text-xs text-muted-foreground">
                              {product.strain_name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{product.sku || "-"}</code>
                      </TableCell>
                      <TableCell>
                        {product.category && <Badge variant="outline">{product.category}</Badge>}
                      </TableCell>
                      <TableCell>${product.cost_per_unit?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>
                        ${product.wholesale_price?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">
                          {profitMargin(product.cost_per_unit, product.wholesale_price)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.available_quantity > 0 ? "default" : "destructive"}>
                          {product.available_quantity || 0} units
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <EnhancedEmptyState
              type="no_products"
              title={searchTerm || categoryFilter !== "all" ? "No products found" : undefined}
              description={
                searchTerm || categoryFilter !== "all"
                  ? "Try adjusting your filters to find products"
                  : undefined
              }
              primaryAction={
                !searchTerm && categoryFilter === "all"
                  ? {
                      label: "Add Product",
                      onClick: () => {
                        resetForm();
                        setIsDialogOpen(true);
                      },
                      icon: <Plus className="h-4 w-4" />,
                    }
                  : undefined
              }
              designSystem="tenant-admin"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
