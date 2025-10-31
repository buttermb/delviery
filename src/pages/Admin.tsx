import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Trash2, Package, Users, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  thca_percentage: number;
  in_stock: boolean;
  image_url?: string;
  lab_results_url?: string;
  strain_info?: string;
}

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: "",
    description: "",
    price: 0,
    category: "flower",
    thca_percentage: 0,
    in_stock: true,
    image_url: "",
    lab_results_url: "",
    strain_info: "",
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // SECURITY: Server-side admin verification using RPC
      const { data: isAdminUser, error } = await supabase.rpc('is_admin', {
        _user_id: user.id
      });

      if (error) {
        console.error('Admin verification error:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(isAdminUser === true);
      }
      
      setLoading(false);
    };

    checkAdmin();
  }, [user]);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: isAdmin,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [ordersRes, usersRes, productsRes] = await Promise.all([
        supabase.from("orders").select("total_amount", { count: "exact" }),
        supabase.from("profiles").select("*", { count: "exact" }),
        supabase.from("products").select("*", { count: "exact" }),
      ]);

      const totalRevenue = ordersRes.data?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

      return {
        totalOrders: ordersRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalProducts: productsRes.count || 0,
        totalRevenue,
      };
    },
    enabled: isAdmin,
  });

  const createProduct = useMutation({
    mutationFn: async (product: Partial<Product>) => {
      const { error } = await supabase.from("products").insert([product as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      const { error } = await supabase.from("products").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, updates: formData });
    } else {
      createProduct.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      category: "flower",
      thca_percentage: 0,
      in_stock: true,
      image_url: "",
      lab_results_url: "",
      strain_info: "",
    });
    setEditingProduct(null);
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalRevenue.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="add">Add/Edit Product</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {productsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {products?.map((product) => (
                <Card key={product.id}>
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded" />
                      )}
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{product.category} • ${product.price}</p>
                        <p className="text-sm text-muted-foreground">Content: {product.thca_percentage}%</p>
                        <p className={`text-sm ${product.in_stock ? "text-green-600" : "text-red-600"}`}>
                          {product.in_stock ? "In Stock" : "Out of Stock"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this product?")) {
                            deleteProduct.mutate(product.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>{editingProduct ? "Edit Product" : "Add New Product"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flower">Flower</SelectItem>
                        <SelectItem value="pre-rolls">Pre-Rolls</SelectItem>
                        <SelectItem value="edibles">Edibles</SelectItem>
                        <SelectItem value="concentrates">Concentrates</SelectItem>
                        <SelectItem value="vapes">Vapes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thca">Cannabinoid Percentage</Label>
                  <Input
                    id="thca"
                    type="number"
                    step="0.01"
                    value={formData.thca_percentage}
                    onChange={(e) => setFormData({ ...formData, thca_percentage: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="strain">Strain Info</Label>
                  <Input
                    id="strain"
                    value={formData.strain_info || ""}
                    onChange={(e) => setFormData({ ...formData, strain_info: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url || ""}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lab_results_url">Lab Results URL (PDF)</Label>
                  <Input
                    id="lab_results_url"
                    value={formData.lab_results_url || ""}
                    onChange={(e) => setFormData({ ...formData, lab_results_url: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="in_stock"
                    checked={formData.in_stock}
                    onCheckedChange={(checked) => setFormData({ ...formData, in_stock: checked })}
                  />
                  <Label htmlFor="in_stock">In Stock</Label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                    {createProduct.isPending || updateProduct.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : editingProduct ? (
                      <Pencil className="h-4 w-4 mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {editingProduct ? "Update Product" : "Add Product"}
                  </Button>
                  {editingProduct && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
