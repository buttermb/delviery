import { useState, useEffect } from "react";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
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
import { EnhancedProductTable } from "@/components/admin/EnhancedProductTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { generateProductSKU } from "@/lib/utils/skuGenerator";
import { generateAndStoreBarcode } from "@/lib/utils/barcodeStorage";
import { syncProductToMenus } from "@/lib/utils/menuSync";
import { ProductLabel } from "@/components/admin/ProductLabel";
import { logger } from "@/lib/logger";
import type { Database } from "@/integrations/supabase/types";

type Product = Database['public']['Tables']['products']['Row'];

export default function ProductManagement() {
  const navigate = useTenantNavigate();
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    vendor_name: "",
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
      // Load products filtered by tenant
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: unknown) {
      logger.error('Failed to load products', error, { component: 'ProductManagement' });
      toast.error("Failed to load products: " + (error instanceof Error ? error.message : "An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenant?.id) {
      toast.error("Tenant not found");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Validate category
      if (!formData.category) {
        toast.error("Category is required", {
          description: "Please select a product category"
        });
        setIsGenerating(false);
        return;
      }

      const validCategories = ['flower', 'edibles', 'vapes', 'concentrates'];
      if (!validCategories.includes(formData.category)) {
        toast.error("Invalid category", {
          description: "Please select a valid category from the dropdown"
        });
        setIsGenerating(false);
        return;
      }

      const category = formData.category;
      let sku = formData.sku?.trim() || null;
      let barcodeImageUrl: string | null = null;

      // Auto-generate SKU if not provided (for new products only)
      if (!editingProduct && !sku) {
        try {
          sku = await generateProductSKU(category, tenant.id);
          logger.debug('Auto-generated SKU', { sku, category, component: 'ProductManagement' });
        } catch (error) {
          logger.error('SKU generation failed', error, { component: 'ProductManagement' });
          // Continue without SKU - product can still be created
        }
      }

      // Generate barcode if SKU exists (for new products only)
      if (!editingProduct && sku) {
        try {
          barcodeImageUrl = await generateAndStoreBarcode(sku, tenant.id);
          if (barcodeImageUrl) {
            logger.debug('Barcode generated', { sku, barcodeImageUrl, component: 'ProductManagement' });
          }
        } catch (error) {
          logger.error('Barcode generation failed', error, { component: 'ProductManagement' });
          // Continue without barcode - product can still be created
        }
      }

      const availableQuantity = formData.available_quantity ? parseInt(formData.available_quantity) : 0;
      const productData = {
        name: formData.name,
        sku: sku,
        category: category,
        vendor_name: formData.vendor_name || null,
        strain_name: formData.strain_name || null,
        strain_type: formData.strain_name ? (formData.strain_name.toLowerCase().includes('hybrid') ? 'Hybrid' : 
          formData.strain_name.toLowerCase().includes('indica') ? 'Indica' : 'Sativa') : null,
        thc_percent: formData.thc_percent ? parseFloat(formData.thc_percent) : null,
        cbd_percent: formData.cbd_percent ? parseFloat(formData.cbd_percent) : null,
        batch_number: formData.batch_number || null,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        retail_price: formData.retail_price ? parseFloat(formData.retail_price) : null,
        price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : 0,
        thca_percentage: formData.thc_percent ? parseFloat(formData.thc_percent) : 0, // Default to 0 instead of null (database requires NOT NULL)
        available_quantity: availableQuantity,
        total_quantity: availableQuantity,
        barcode_image_url: barcodeImageUrl,
        tenant_id: tenant.id,
        // menu_visibility will be set by trigger based on available_quantity
      };

      if (editingProduct) {
        const { data: updatedProduct, error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)
          .select()
          .single();

        if (error) throw error;
        
        // Sync to menus if stock changed
        if (availableQuantity > 0) {
          await syncProductToMenus(updatedProduct.id, tenant.id);
        }
        
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

        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([productData])
          .select()
          .single();

        if (error) throw error;
        
        // Auto-sync to menus if stock > 0
        if (availableQuantity > 0 && newProduct) {
          await syncProductToMenus(newProduct.id, tenant.id);
        }
        
        toast.success("Product created successfully", {
          description: sku ? `SKU: ${sku}` : undefined,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (error: unknown) {
      // Log full error details to console for debugging
      console.error('Product save error:', error);
      console.error('Form data:', formData);
      
      logger.error('Failed to save product', error, { 
        component: 'ProductManagement',
        formData,
        tenantId: tenant?.id,
      });
      
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      const errorCode = (error as any)?.code;
      const errorDetails = (error as any)?.details;
      
      // Check for specific error types
      let userMessage = errorMessage;
      let errorTitle = "Failed to save product";
      
      if (errorMessage.includes('null value') || errorMessage.includes('NOT NULL')) {
        userMessage = "Missing required fields. Please fill in all required information.";
        errorTitle = "Required Field Missing";
      } else if (errorMessage.includes('violates check constraint') || errorMessage.includes('category')) {
        userMessage = "Invalid category selected. Please choose: Flower, Edibles, Vapes, or Concentrates.";
        errorTitle = "Invalid Category";
      } else if (errorMessage.includes('duplicate key') || errorCode === '23505') {
        userMessage = "A product with this SKU already exists.";
        errorTitle = "Duplicate Product";
      } else if (errorCode === '42703') {
        userMessage = "Database column not found. Please contact support.";
        errorTitle = "Database Error";
      } else if (errorDetails) {
        userMessage = `${errorMessage} (Details: ${errorDetails})`;
      }
      
      toast.error(errorTitle, {
        description: userMessage,
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      sku: product.sku || "",
      category: product.category || "",
      vendor_name: product.vendor_name || "",
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

    if (!tenant?.id) {
      toast.error("Tenant not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      
      if (error) throw error;
      toast.success("Product deleted");
      loadProducts();
      setSelectedProducts((prev) => prev.filter((pid) => pid !== id));
    } catch (error: unknown) {
      logger.error('Failed to delete product', error, { component: 'ProductManagement', productId: id });
      toast.error("Failed to delete: " + (error instanceof Error ? error.message : "An error occurred"));
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!tenant?.id) {
      toast.error("Tenant not found");
      return;
    }

    const productToDuplicate = products.find((p) => p.id === id);
    if (!productToDuplicate) return;

    try {
      const { id: _id, created_at, ...productData } = productToDuplicate;
      const duplicatedProduct = {
        ...productData,
        name: `${productData.name} (Copy)`,
        sku: null, // Clear SKU so new one is auto-generated
        barcode_image_url: null, // Clear barcode so new one is generated
        tenant_id: tenant.id,
      };

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert([duplicatedProduct])
        .select()
        .single();
      
      if (error) throw error;
      
      // Auto-generate SKU and barcode for duplicated product
      if (newProduct) {
        const category = productData.category || "Uncategorized";
        try {
          const newSku = await generateProductSKU(category, tenant.id);
          const barcodeUrl = await generateAndStoreBarcode(newSku, tenant.id);
          
          await supabase
            .from("products")
            .update({ sku: newSku, barcode_image_url: barcodeUrl })
            .eq("id", newProduct.id);
        } catch (error) {
          logger.warn('Failed to generate SKU/barcode for duplicated product', error, {
            component: 'ProductManagement',
            productId: newProduct.id,
          });
          // Continue - product is created even without SKU/barcode
        }
        
        // Sync to menus if stock > 0
        if ((productData.available_quantity ?? 0) > 0) {
          await syncProductToMenus(newProduct.id, tenant.id);
        }
      }
      
      toast.success("Product duplicated successfully");
      loadProducts();
    } catch (error: unknown) {
      logger.error('Failed to duplicate product', error, { component: 'ProductManagement', productId: id });
      toast.error("Failed to duplicate product: " + (error instanceof Error ? error.message : "An error occurred"));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const profitMargin = (cost: number, price: number) => {
    if (!cost || !price) return 0;
    return (((price - cost) / price) * 100).toFixed(1);
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

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  );

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Product>) => {
    if (!tenant?.id) {
      toast.error("Tenant not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
      
      // Sync to menus if stock changed
      if ('available_quantity' in updates && updates.available_quantity > 0) {
        await syncProductToMenus(id, tenant.id);
      }
      
      toast.success("Product updated");
      loadProducts();
    } catch (error: unknown) {
      logger.error('Failed to update product', error, { component: 'ProductManagement', productId: id });
      toast.error("Failed to update: " + (error instanceof Error ? error.message : "An error occurred"));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category: "flower", // Default to valid category
      vendor_name: "",
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
          <Button onClick={() => navigate("/admin/generate-barcodes")}>
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
                    <Label>SKU {!editingProduct && <span className="text-muted-foreground text-xs">(Auto-generated)</span>}</Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      placeholder={editingProduct ? "SKU" : "Auto-generated if empty"}
                      readOnly={!editingProduct}
                      className={!editingProduct ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flower">Flower</SelectItem>
                        <SelectItem value="edibles">Edibles</SelectItem>
                        <SelectItem value="vapes">Vapes</SelectItem>
                        <SelectItem value="concentrates">Concentrates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <AutocompleteInput
                      value={formData.vendor_name}
                      onChange={(value) =>
                        setFormData({ ...formData, vendor_name: value })
                      }
                      type="brand"
                      placeholder="Vendor/Brand name (e.g., Cookies, Jungle Boys)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Strain Name</Label>
                    <AutocompleteInput
                      value={formData.strain_name}
                      onChange={(value) =>
                        setFormData({ ...formData, strain_name: value })
                      }
                      type="strain"
                      placeholder="Strain name (e.g., Gelato, Runtz, OG Kush)"
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
                  <Button type="submit" disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingProduct ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      editingProduct ? "Update Product" : "Create Product"
                    )}
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

      {/* Filters and View Mode Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {viewMode === "grid" && (
          <>
            <div className="relative flex-1 w-full sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 min-h-[44px]"
              />
            </div>
            <div className="flex gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
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
                <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="price">Price (High-Low)</SelectItem>
                  <SelectItem value="stock">Stock (High-Low)</SelectItem>
                  <SelectItem value="margin">Margin (High-Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        
        {/* View Mode Toggle */}
        <div className={viewMode === "list" ? "ml-auto" : ""}>
          <div className="flex items-center gap-1 border rounded-md overflow-hidden min-h-[44px]">
            <Toggle
              pressed={viewMode === "grid"}
              onPressedChange={() => setViewMode("grid")}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none min-h-[44px] min-w-[44px]"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === "list"}
              onPressedChange={() => setViewMode("list")}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none border-l min-h-[44px] min-w-[44px]"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
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
                  onEdit={() => handleEdit(product)}
                  onDelete={() => handleDelete(product.id)}
                  onPrintLabel={() => {
                    setLabelProduct(product as any);
                    setLabelDialogOpen(true);
                  }}
                />
                ))}
              </div>
            ) : (
              <EnhancedProductTable
                products={products}
                selectedProducts={selectedProducts}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onEdit={(id) => {
                  const product = products.find(p => p.id === id);
                  if (product) handleEdit(product);
                }}
                onDuplicate={handleDuplicate}
                onPrintLabel={(product) => {
                  setLabelProduct(product as any);
                  setLabelDialogOpen(true);
                }}
              />
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

      {/* Product Label Dialog */}
      {labelProduct && (
        <ProductLabel
          product={labelProduct as any}
          open={labelDialogOpen}
          onOpenChange={setLabelDialogOpen}
        />
      )}
    </div>
  );
}
