import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/contexts/AccountContext";
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
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function ProductManagement() {
  const navigate = useNavigate();
  const { account, loading: accountLoading } = useAccount();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

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
    if (account && !accountLoading) {
      loadProducts();
    } else if (!accountLoading && !account) {
      setLoading(false);
    }
  }, [account, accountLoading]);

  const loadProducts = async () => {
    if (!account) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by account if account_id column exists
      // If your products table doesn't have account_id, this will work for all products
      if (account.id) {
        // Check if account_id column exists by trying to filter
        // Most likely products are shared, so we might not filter
        // Uncomment if products table has account_id:
        // query = query.eq('account_id', account.id);
      }

      const { data, error } = await query;

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
        if ((account as any)?.tenant_id) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('usage, limits')
            .eq('id', (account as any).tenant_id)
            .maybeSingle();

          if (tenant) {
            const currentProducts = (tenant.usage as any)?.products || 0;
            const productLimit = (tenant.limits as any)?.products || 0;
            
            if (productLimit > 0 && currentProducts >= productLimit) {
              toast.error('Product limit reached', {
                description: `You've reached your product limit (${currentProducts}/${productLimit}). Please upgrade your plan.`,
              });
              return;
            }
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

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const profitMargin = (cost: number, price: number) => {
    if (!cost || !price) return 0;
    return (((price - cost) / price) * 100).toFixed(1);
  };

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading account...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-2">Account Setup Required</CardTitle>
            <CardDescription>
              You need to set up your account before accessing product management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                To manage products, you need to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Create or join an account</li>
                <li>Set up your company information</li>
                <li>Configure your business settings</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate('/signup')}>
                Create Account
              </Button>
              <Button variant="outline" onClick={() => navigate('/onboarding')}>
                Complete Setup
              </Button>
              <Button variant="ghost" onClick={() => navigate('/admin/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-muted-foreground">
            Manage products, batches, and inventory packages
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
