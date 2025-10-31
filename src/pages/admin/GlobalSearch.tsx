import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, User, Package, ShoppingCart, MapPin, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatStatus } from "@/utils/stringHelpers";

const GlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["global-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return null;

      const searchLower = searchTerm.toLowerCase();

      const [users, orders, products, addresses] = await Promise.all([
        // Search users
        supabase
          .from("profiles")
          .select("*, user_roles(role)")
          .or(`full_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
          .limit(10),

        // Search orders
        supabase
          .from("orders")
          .select("*, profiles(full_name)")
          .or(`order_number.ilike.%${searchLower}%,tracking_code.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`)
          .limit(10),

        // Search products
        supabase
          .from("products")
          .select("*")
          .or(`name.ilike.%${searchLower}%,description.ilike.%${searchLower}%,category.ilike.%${searchLower}%`)
          .limit(10),

        // Search addresses
        supabase
          .from("addresses")
          .select("*, profiles(full_name)")
          .or(`street.ilike.%${searchLower}%,neighborhood.ilike.%${searchLower}%,borough.ilike.%${searchLower}%`)
          .limit(10),
      ]);

      return {
        users: users.data || [],
        orders: orders.data || [],
        products: products.data || [],
        addresses: addresses.data || [],
        totalResults: 
          (users.data?.length || 0) + 
          (orders.data?.length || 0) + 
          (products.data?.length || 0) + 
          (addresses.data?.length || 0),
      };
    },
    enabled: searchTerm.length >= 2,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global Search</h1>
        <p className="text-muted-foreground">
          Search across all users, orders, products, and addresses
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, order number, product, address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-lg h-12"
              autoFocus
            />
          </div>
          {searchResults && (
            <p className="text-sm text-muted-foreground mt-2">
              Found {searchResults.totalResults} results across all categories
            </p>
          )}
        </CardHeader>
        <CardContent>
          {searchTerm.length < 2 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Enter at least 2 characters to search</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : searchResults && searchResults.totalResults > 0 ? (
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="users">
                  Users ({searchResults.users.length})
                </TabsTrigger>
                <TabsTrigger value="orders">
                  Orders ({searchResults.orders.length})
                </TabsTrigger>
                <TabsTrigger value="products">
                  Products ({searchResults.products.length})
                </TabsTrigger>
                <TabsTrigger value="addresses">
                  Addresses ({searchResults.addresses.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4">
                {searchResults.users.map((user: any) => (
                  <Card key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/users/${user.user_id}`)}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{user.full_name || "Unknown"}</h3>
                            <Badge variant={user.trust_level === "vip" ? "default" : "secondary"}>
                              {user.trust_level || "new"}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            {user.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Orders: {user.total_orders || 0} • Risk: {user.risk_score || "N/A"}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">View Profile</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                {searchResults.orders.map((order: any) => (
                  <Card key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/orders`)}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">Order #{order.order_number}</h3>
                            <Badge>{formatStatus(order?.status || 'pending')}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Customer: {order.profiles?.full_name || order.customer_name || "Guest"}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>${order.total_amount}</span>
                            <span>Tracking: {order.tracking_code}</span>
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">View Order</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                {searchResults.products.map((product: any) => (
                  <Card key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/products`)}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {product.image_url && (
                          <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded" />
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{product.name}</h3>
                            <Badge variant="secondary">{product.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>${product.price}</span>
                            <span>Stock: {product.stock || 0}</span>
                            {product.average_rating && <span>⭐ {product.average_rating.toFixed(1)}</span>}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Edit Product</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="addresses" className="space-y-4">
                {searchResults.addresses.map((address: any) => (
                  <Card key={address.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/users/${address.user_id}`)}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{address.street}</h3>
                            {address.is_default && <Badge variant="default">Default</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {address.profiles?.full_name}
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{address.neighborhood}</span>
                            <span>•</span>
                            <span>{address.borough}</span>
                            <span>•</span>
                            <span>{address.zip_code}</span>
                          </div>
                          {address.risk_zone && (
                            <Badge variant={address.risk_zone === "red" ? "destructive" : address.risk_zone === "yellow" ? "secondary" : "outline"}>
                              {address.risk_zone} zone
                            </Badge>
                          )}
                        </div>
                        <Button variant="outline" size="sm">View User</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No results found for "{searchTerm}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalSearch;