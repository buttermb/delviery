import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart, Lock } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { validateRouteUUID } from "@/lib/utils/uuidValidation";

export default function CustomerMenuViewPage() {
  const { menuId: menuIdParam } = useParams<{ menuId: string }>();
  const menuId = validateRouteUUID(menuIdParam);
  const navigate = useNavigate();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;

  // Fetch menu details
  const { data: menu, isLoading: menuLoading } = useQuery({
    queryKey: ["customer-menu", menuId, tenantId, customerId],
    queryFn: async () => {
      if (!menuId || !tenantId || !customerId) return null;

      // Verify customer has access
      const { data: access } = await supabase
        .from("menu_access")
        .select("*")
        .eq("menu_id", menuId as string)
        .eq("customer_id", customerId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!access) {
        throw new Error("You don't have access to this menu");
      }

      // Check if expired
      if (access.expires_at && new Date(access.expires_at) < new Date()) {
        throw new Error("Menu access has expired");
      }

      // Fetch menu
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("id", menuId as string)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Menu not found");

      return {
        ...data,
        access_code: access.access_code,
        expires_at: access.expires_at,
      };
    },
    enabled: !!menuId && !!tenantId && !!customerId,
  });

  // Fetch menu products
  const { data: products } = useQuery({
    queryKey: ["customer-menu-products", menuId, tenantId],
    queryFn: async () => {
      if (!menuId || !tenantId) return [];

      const { data, error } = await supabase
        .from("menu_products")
        .select(`
          *,
          products (
            id,
            name,
            description,
            price,
            unit,
            image_url,
            category
          )
        `)
        .eq("menu_id", menuId as string);

      if (error) throw error;
      return data || [];
    },
    enabled: !!menuId && !!tenantId,
  });

  if (menuLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading menu...</p>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground mb-4">Menu not found or access denied</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const requiresAccessCode = !!menu.access_code;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold mt-2">{menu.name}</h1>
            {menu.description && (
              <p className="text-muted-foreground mt-1">{menu.description}</p>
            )}
          </div>
          {requiresAccessCode && (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              Access Code Required
            </Badge>
          )}
        </div>

        {/* Menu Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={menu.is_active ? "default" : "outline"}>
                  {menu.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {menu.expires_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expires</p>
                  <p className="text-base">
                    {new Date(menu.expires_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Products</p>
                <p className="text-base font-semibold">{products?.length || 0} items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {products && products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((item: any) => {
                  const product = item.products;
                  if (!product) return null;

                  return (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-48 object-cover rounded-lg mb-3"
                          />
                        )}
                        <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">{formatCurrency(product.price || 0)}</p>
                            {product.unit && (
                              <p className="text-xs text-muted-foreground">per {product.unit}</p>
                            )}
                          </div>
                          <Button size="sm">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        </div>
                        {product.category && (
                          <Badge variant="outline" className="mt-2">
                            {product.category}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No products available in this menu</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Place Order Button */}
        {products && products.length > 0 && (
          <div className="sticky bottom-0 bg-background border-t p-4">
            <Button className="w-full" size="lg">
              <ShoppingCart className="h-5 w-5 mr-2" />
              View Cart & Place Order
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

