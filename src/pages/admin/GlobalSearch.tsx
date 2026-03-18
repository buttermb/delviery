import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { sanitizeSearchInput } from "@/lib/sanitizeSearch";
import { logger } from "@/lib/logger";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  User,
  Package,
  ShoppingCart,
  MapPin,
  Mail,
  Phone,
  Star,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatStatus } from "@/utils/stringHelpers";
import { formatSmartDate, formatPhoneNumber } from "@/lib/formatters";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";

interface UserSearchResult {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  trust_level?: string;
  total_orders?: number;
  risk_score?: string | number;
  user_roles?: { role: string }[];
}

interface OrderSearchResult {
  id: string;
  order_number: string;
  tracking_code?: string;
  customer_name?: string;
  status: string;
  total_amount: number;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface ProductSearchResult {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  stock_quantity?: number;
  average_rating?: number;
  image_url?: string;
}

interface AddressSearchResult {
  id: string;
  user_id: string;
  street: string;
  neighborhood?: string;
  borough?: string;
  zip_code?: string;
  is_default?: boolean;
  risk_zone?: string;
  profiles?: {
    full_name: string;
  };
}

interface SearchResults {
  users: UserSearchResult[];
  orders: OrderSearchResult[];
  products: ProductSearchResult[];
  addresses: AddressSearchResult[];
  totalResults: number;
}

const GlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();

  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: queryKeys.globalSearch.all(debouncedSearch, tenant?.id),
    queryFn: async (): Promise<SearchResults | null> => {
      if (!debouncedSearch || debouncedSearch.length < 2 || !tenant) return null;

      const searchLower = debouncedSearch.toLowerCase();
      const escapedSearch = sanitizeSearchInput(searchLower);

      const [users, orders, products, addresses] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, user_id, full_name, email, phone, trust_level, total_orders, risk_score, user_roles(role)")
          .eq("account_id", tenant.id)
          .or(`full_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%`)
          .limit(10),
        supabase
          .from("orders")
          .select("id, order_number, tracking_code, customer_name, status, total_amount, created_at, profiles(full_name)")
          .eq("tenant_id", tenant.id)
          .or(`order_number.ilike.%${escapedSearch}%,tracking_code.ilike.%${escapedSearch}%,customer_name.ilike.%${escapedSearch}%`)
          .limit(10),
        supabase
          .from("products")
          .select("id, name, description, category, price, stock_quantity, average_rating, image_url")
          .eq("tenant_id", tenant.id)
          .or(`name.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%,category.ilike.%${escapedSearch}%`)
          .limit(10),
        supabase
          .from("addresses")
          .select("id, user_id, street, neighborhood, borough, zip_code, is_default, risk_zone, profiles(full_name)")
          .eq("tenant_id", tenant.id)
          .or(`street.ilike.%${escapedSearch}%,neighborhood.ilike.%${escapedSearch}%,borough.ilike.%${escapedSearch}%`)
          .limit(10),
      ]);

      if (users.error) logger.warn("Global search: users query failed", { error: users.error });
      if (orders.error) logger.warn("Global search: orders query failed", { error: orders.error });
      if (products.error) logger.warn("Global search: products query failed", { error: products.error });
      if (addresses.error) logger.warn("Global search: addresses query failed", { error: addresses.error });

      return {
        users: (users.data ?? []) as unknown as UserSearchResult[],
        orders: (orders.data ?? []) as unknown as OrderSearchResult[],
        products: (products.data ?? []) as unknown as ProductSearchResult[],
        addresses: (addresses.data ?? []) as unknown as AddressSearchResult[],
        totalResults:
          (users.data?.length ?? 0) +
          (orders.data?.length ?? 0) +
          (products.data?.length ?? 0) +
          (addresses.data?.length ?? 0),
      };
    },
    enabled: debouncedSearch.length >= 2 && !!tenant,
    staleTime: 30_000,
    retry: 2,
  });

  const navigateToOrder = (orderId: string) => {
    navigate(`/${tenant?.slug}/admin/orders/${orderId}`);
  };

  const navigateToProduct = (productId: string) => {
    navigate(`/${tenant?.slug}/admin/products/${productId}`);
  };

  const navigateToUser = (userId: string) => {
    navigate(`/${tenant?.slug}/admin/users/${userId}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Global Search</h1>
        <p className="text-muted-foreground">
          Search across all users, orders, products, and addresses
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Label htmlFor="global-search-input" className="sr-only">
              Search by name, email, order number, product, or address
            </Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="global-search-input"
              placeholder="Search by name, email, order number, product, address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-lg h-12"
              autoFocus
              aria-label="Global search"
            />
          </div>
          {searchResults && (
            <p className="text-sm text-muted-foreground mt-2">
              Found {searchResults.totalResults} results across all categories
            </p>
          )}
        </CardHeader>
        <CardContent>
          {debouncedSearch.length < 2 ? (
            <EnhancedEmptyState
              icon={Search}
              title="Global Search"
              description="Enter at least 2 characters to search across users, orders, products, and addresses."
              compact
            />
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Search failed. Please try again.
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <EnhancedLoadingState variant="spinner" message="Searching across the platform..." className="py-12" />
          ) : searchResults && searchResults.totalResults > 0 ? (
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="flex w-full overflow-x-auto">
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
                {searchResults.users.map((user: UserSearchResult) => (
                  <Card
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateToUser(user.user_id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View profile for ${user.full_name || "Unknown"}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToUser(user.user_id);
                      }
                    }}
                  >
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
                                {formatPhoneNumber(user.phone)}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Orders: {user.total_orders ?? 0} • Risk: {user.risk_score || "N/A"}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`View profile for ${user.full_name || "Unknown"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToUser(user.user_id);
                          }}
                        >
                          View Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                {searchResults.orders.map((order: OrderSearchResult) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateToOrder(order.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View order #${order.order_number}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToOrder(order.id);
                      }
                    }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">Order #{order.order_number}</h3>
                            <Badge>{formatStatus(order.status || "pending")}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Customer: {order.profiles?.full_name || order.customer_name || "Guest"}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>${order.total_amount}</span>
                            <span>Tracking: {order.tracking_code || "N/A"}</span>
                            <span>{formatSmartDate(order.created_at)}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`View order #${order.order_number}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToOrder(order.id);
                          }}
                        >
                          View Order
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                {searchResults.products.map((product: ProductSearchResult) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateToProduct(product.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View product ${product.name}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToProduct(product.id);
                      }
                    }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{product.name}</h3>
                            <Badge variant="secondary">{product.category}</Badge>
                          </div>
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>${product.price}</span>
                            <span>Stock: {product.stock_quantity ?? 0}</span>
                            {product.average_rating != null && (
                              <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {product.average_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`View product ${product.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToProduct(product.id);
                          }}
                        >
                          View Product
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="addresses" className="space-y-4">
                {searchResults.addresses.map((address: AddressSearchResult) => (
                  <Card
                    key={address.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateToUser(address.user_id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View user at ${address.street}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateToUser(address.user_id);
                      }
                    }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{address.street}</h3>
                            {address.is_default && <Badge variant="default">Default</Badge>}
                          </div>
                          {address.profiles?.full_name && (
                            <div className="text-sm text-muted-foreground">
                              {address.profiles.full_name}
                            </div>
                          )}
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {[address.neighborhood, address.borough, address.zip_code]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                          {address.risk_zone && (
                            <Badge
                              variant={
                                address.risk_zone === "red"
                                  ? "destructive"
                                  : address.risk_zone === "yellow"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {address.risk_zone} zone
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`View user at ${address.street}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToUser(address.user_id);
                          }}
                        >
                          View User
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          ) : (
            <EnhancedEmptyState
              icon={Search}
              title="No Results Found"
              description={`No results found for "${debouncedSearch}". Try a different search term.`}
              compact
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalSearch;
