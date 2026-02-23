import { logger } from '@/lib/logger';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  WifiOff,
  Wifi,
  Package,
  Plus,
  Minus,
  Search,
  Loader2,
  ShoppingCart,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Cloud,
} from 'lucide-react';
import { CustomerAutoAssociation } from '@/components/admin/orders/CustomerAutoAssociation';
import { OfflineBadge } from '@/components/ui/offline-indicator';
import { SEOHead } from '@/components/SEOHead';

import type { CustomerMatch } from '@/hooks/useCustomerLookup';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useOfflineOrderCreation, OfflineOrderItem, OfflineOrderData } from '@/hooks/useOfflineOrderCreation';
import { db as idb } from '@/lib/idb';
import { cn } from '@/lib/utils';
import { ShortcutHint, useModifierKey } from '@/components/ui/shortcut-hint';

interface ProductForOrder {
  id: string;
  name: string;
  price: number;
  sku: string;
  stock?: number;
}

export default function OfflineOrderCreate() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const {
    offlineOrders,
    isOnline,
    isSyncing,
    createOfflineOrder,
    syncOfflineOrders,
    removeOfflineOrder,
    retryOrder,
  } = useOfflineOrderCreation(tenant?.id);

  const mod = useModifierKey();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash');
  const [cart, setCart] = useState<OfflineOrderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'pending'>('create');
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerMatch | null>(null);

  // Fetch products (from Supabase if online, from IndexedDB if offline)
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-offline-order', tenant?.id, isOnline],
    queryFn: async (): Promise<ProductForOrder[]> => {
      if (isOnline && tenant?.id) {
        // Fetch from Supabase and cache in IndexedDB
        const { data, error } = await (supabase as any)
          .from('products')
          .select('id, name, price, sku')
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .order('name');

        if (error) {
          logger.error('Failed to fetch products', error, { component: 'OfflineOrderCreate' });
          // Fall back to IndexedDB
          return loadProductsFromIDB();
        }

        const products: ProductForOrder[] = (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price || 0,
          sku: p.sku || '',
        }));

        // Cache products in IndexedDB for offline use
        for (const product of products) {
          await idb.saveProduct({
            id: product.id,
            name: product.name,
            price: product.price,
            sku: product.sku,
            updatedAt: Date.now(),
          });
        }

        return products;
      }

      // Offline: load from IndexedDB
      return loadProductsFromIDB();
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  async function loadProductsFromIDB(): Promise<ProductForOrder[]> {
    try {
      const cached = await idb.getAllProducts();
      return cached.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        sku: p.sku,
      }));
    } catch (error) {
      logger.error('Failed to load products from IndexedDB', error instanceof Error ? error : new Error(String(error)), { component: 'OfflineOrderCreate' });
      return [];
    }
  }

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const query = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  // Cart calculations
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart]
  );
  const taxRate = 0; // Tax is typically handled on sync
  const taxAmount = subtotal * taxRate;
  const deliveryFee = 0;
  const totalAmount = subtotal + taxAmount + deliveryFee;

  // Cart operations
  const addToCart = useCallback((product: ProductForOrder) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          sku: product.sku,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      customerName.trim().length > 0 &&
      deliveryAddress.trim().length > 0 &&
      cart.length > 0
    );
  }, [customerName, deliveryAddress, cart]);

  // Submit order
  const handleSubmit = async () => {
    if (!isFormValid || !tenant?.id) return;

    setIsSubmitting(true);
    try {
      await createOfflineOrder({
        tenantId: tenant.id,
        customerId: linkedCustomer?.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        deliveryAddress: deliveryAddress.trim(),
        deliveryNotes: deliveryNotes.trim() || undefined,
        paymentMethod,
        items: cart,
        subtotal,
        taxAmount,
        deliveryFee,
        totalAmount,
      });

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setDeliveryAddress('');
      setDeliveryNotes('');
      setPaymentMethod('cash');
      setCart([]);
      setLinkedCustomer(null);

      if (isOnline) {
        toast.success('Order created and synced');
      } else {
        toast.success('Order saved offline', {
          description: 'Will sync when connection is restored',
        });
      }
    } catch (error) {
      logger.error('Failed to create offline order', error instanceof Error ? error : new Error(String(error)), { component: 'OfflineOrderCreate' });
      toast.error('Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingOrders = offlineOrders.filter((o) => o.status !== 'synced');

  const getStatusBadge = (status: OfflineOrderData['status']) => {
    switch (status) {
      case 'pending_sync':
        return <Badge variant="secondary" className="gap-1"><Cloud className="h-3 w-3" />Pending Sync</Badge>;
      case 'syncing':
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Syncing</Badge>;
      case 'synced':
        return <Badge variant="outline" className="gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" />Synced</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <SEOHead
        title="Create Order (Offline) | Admin"
        description="Create orders that work offline and sync when back online"
      />

      <div className="w-full max-w-full px-2 sm:px-4 md:px-4 py-2 sm:py-4 md:py-4 space-y-4 sm:space-y-4 overflow-x-hidden pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/orders')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold">Create Order</h1>
                <OfflineBadge isOnline={isOnline} />
              </div>
              <p className="text-sm text-muted-foreground">
                {isOnline ? 'Connected - orders sync immediately' : 'Offline - orders saved locally'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingOrders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncOfflineOrders()}
                disabled={!isOnline || isSyncing}
                className="gap-1"
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                Sync ({pendingOrders.length})
              </Button>
            )}
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm">
              {isOnline ? (
                <><Wifi className="h-4 w-4 text-green-500" /> Online</>
              ) : (
                <><WifiOff className="h-4 w-4 text-amber-500" /> Offline</>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'create'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab('create')}
          >
            New Order
          </button>
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'pending'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab('pending')}
          >
            Pending Orders
            {pendingOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {pendingOrders.length}
              </Badge>
            )}
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column: Product Selection */}
            <div className="lg:col-span-2 space-y-4">
              {/* Product Search */}
              <Card className="p-4 border-none shadow-sm">
                <h3 className="text-sm font-medium mb-3">Products</h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Search products by name or SKU"
                    placeholder="Search products by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {productsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {!isOnline && products.length === 0
                        ? 'No cached products available. Go online to load products.'
                        : 'No products found'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-auto">
                    {filteredProducts.map((product) => {
                      const inCart = cart.find((item) => item.productId === product.id);
                      return (
                        <div
                          key={product.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors",
                            inCart && "bg-primary/5"
                          )}
                          onClick={() => addToCart(product)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            {product.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-sm font-mono">${product.price.toFixed(2)}</span>
                            {inCart ? (
                              <Badge variant="secondary" className="h-5 px-1.5">
                                {inCart.quantity}
                              </Badge>
                            ) : (
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Customer & Delivery Details */}
              <Card className="p-4 border-none shadow-sm">
                <h3 className="text-sm font-medium mb-3">Customer Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="customerName" className="text-xs">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Full name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerPhone" className="text-xs">Phone</Label>
                    <Input
                      id="customerPhone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 555-5555"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="customerEmail" className="text-xs">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@email.com"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="deliveryAddress" className="text-xs">
                      Delivery Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="123 Main St, City, State ZIP"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="deliveryNotes" className="text-xs">Delivery Notes</Label>
                    <Textarea
                      id="deliveryNotes"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="Special instructions..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentMethod" className="text-xs">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'card' | 'credit')}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Customer Auto-Association */}
                  <div className="sm:col-span-2">
                    <CustomerAutoAssociation
                      phone={customerPhone}
                      email={customerEmail}
                      customerName={customerName}
                      deliveryAddress={deliveryAddress}
                      selectedCustomer={linkedCustomer}
                      onCustomerSelect={setLinkedCustomer}
                      onCustomerCreate={(customer) => {
                        // Auto-fill form with created customer data
                        if (customer.phone) setCustomerPhone(customer.phone);
                        if (customer.email) setCustomerEmail(customer.email);
                      }}
                      disabled={!isOnline}
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Cart & Summary */}
            <div className="space-y-4">
              <Card className="p-4 border-none shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Cart ({cart.length})
                  </h3>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Cart is empty</p>
                    <p className="text-xs">Click products to add them</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {cart.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            ${item.unitPrice.toFixed(2)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => updateQuantity(item.productId, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => updateQuantity(item.productId, 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-6 sm:w-6 text-destructive"
                            onClick={() => removeFromCart(item.productId)}
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Order Summary */}
                {cart.length > 0 && (
                  <div className="mt-4 pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                    </div>
                    {taxAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-mono">${taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-mono">${deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>Total</span>
                      <span className="font-mono">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <ShortcutHint keys={[mod, "S"]} label="Save">
                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                    ) : !isOnline ? (
                      <><WifiOff className="mr-2 h-4 w-4" />Save Offline</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4" />Create Order</>
                    )}
                  </Button>
                </ShortcutHint>

                {!isOnline && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Order will sync when you're back online
                  </p>
                )}
              </Card>
            </div>
          </div>
        ) : (
          /* Pending Orders Tab */
          <div className="space-y-4">
            {pendingOrders.length === 0 ? (
              <Card className="p-8 border-none shadow-sm text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No pending offline orders to sync.
                </p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} pending sync
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => syncOfflineOrders()}
                    disabled={!isOnline || isSyncing}
                    className="gap-1"
                  >
                    <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                    Sync All
                  </Button>
                </div>

                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <Card key={order.id} className="p-4 border-none shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{order.customerName}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.items.length} item{order.items.length > 1 ? 's' : ''} - ${order.totalAmount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                          </p>
                          {order.syncError && (
                            <p className="text-xs text-destructive mt-1">
                              Error: {order.syncError}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {order.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 sm:h-8 sm:w-8"
                              onClick={() => retryOrder(order.id)}
                              disabled={!isOnline}
                              title="Retry sync"
                              aria-label="Retry sync"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-8 sm:w-8 text-destructive"
                            onClick={() => removeOfflineOrder(order.id)}
                            title="Remove order"
                            aria-label="Remove order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Order items preview */}
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex flex-wrap gap-1">
                          {order.items.slice(0, 3).map((item, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {item.productName} x{item.quantity}
                            </Badge>
                          ))}
                          {order.items.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{order.items.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
