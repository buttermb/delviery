import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { Search, ShoppingCart, Trash2, Plus, Minus, DollarSign, Maximize2, Minimize2, Share2, Receipt, Loader2, AlertCircle } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { logActivityAuto, ActivityActions } from '@/lib/activityLogger';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingPickupsPanel } from '@/components/pos/PendingPickupsPanel';
import { PendingOrder } from '@/hooks/usePendingOrders';
import { orderFlowManager } from '@/lib/orders/orderFlowManager';
import { QuickMenuWizard } from '@/components/pos/QuickMenuWizard';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock_quantity: number;
  thc_percent: number | null;
  image_url: string | null;
}

export interface CartItem extends Product {
  quantity: number;
  subtotal: number;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  customer_type: string;
  loyalty_points: number;
}

export default function PointOfSale() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('register');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { dialogState, confirm, closeDialog, setLoading: setDialogLoading } = useConfirmDialog();
  const [_pendingLoadOrder, setPendingLoadOrder] = useState<PendingOrder | null>(null);

  // Handle image load error - fall back to placeholder
  const handleImageError = useCallback((productId: string) => {
    setFailedImages(prev => new Set(prev).add(productId));
  }, []);

  useInventorySync({ tenantId, enabled: !!tenantId });

  // Enable realtime sync for wholesale_orders and products
  useRealtimeSync({
    tenantId,
    tables: ['wholesale_orders', 'products'],
    enabled: !!tenantId,
  });

  // Load customers via useQuery with loading/error states
  const { data: customers = [], isLoading: customersLoading, isError: customersError, refetch: _refetchCustomers } = useQuery({
    queryKey: queryKeys.customers.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, first_name, last_name, customer_type, loyalty_points')
          .eq('tenant_id', tenantId)
          .order('first_name');

        if (error) {
          if (error.code === '42P01') return [];
          throw error;
        }

        return (data ?? []).map((c): Customer => ({
          id: c.id,
          first_name: c.first_name ?? '',
          last_name: c.last_name ?? '',
          customer_type: c.customer_type ?? '',
          loyalty_points: typeof c.loyalty_points === 'number' ? c.loyalty_points : 0,
        }));
      } catch (err) {
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === '42P01') return [];
        throw err;
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (tenantId) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProducts is defined below, only run when tenantId changes
  }, [tenantId]);

  useEffect(() => {
    filterProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterProducts is defined below, runs when search/filter/products change
  }, [searchQuery, categoryFilter, products]);

  // Full screen toggle handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullScreen]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, category, stock_quantity, thc_percent, image_url')
        .eq('tenant_id', tenantId)
        .eq('in_stock', true)
        .order('name');

      if (error) throw error;

      // Map to our Product interface with proper type checking
      const mappedProducts: Product[] = (data ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? '',
        price: typeof p.price === 'number' ? p.price : 0,
        category: p.category || null,
        stock_quantity: typeof p.stock_quantity === 'number' ? p.stock_quantity : 0,
        thc_percent: typeof p.thc_percent === 'number' ? p.thc_percent : null,
        image_url: p.image_url || null
      }));

      setProducts(mappedProducts);
    } catch (error) {
      logger.error('Error loading products', error);
      toast.error('Error loading products');
    }
  };

  // loadCustomers removed — now uses useQuery above

  const filterProducts = () => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    setFilteredProducts(filtered);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast.error('Not enough stock');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, subtotal: product.price }]);
    }
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = Math.max(1, Math.min(item.stock_quantity, item.quantity + change));
        return { ...item, quantity: newQuantity, subtotal: newQuantity * item.price };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setCashTendered('');
    setActiveOrderId(null);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.08875; // 8.875% tax
    const discount = selectedCustomer?.customer_type === 'medical' ? subtotal * 0.05 : 0;
    const total = subtotal + tax - discount;

    return { subtotal, tax, discount, total };
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!tenantId) {
      toast.error('Tenant not loaded');
      return;
    }

    // Check free tier daily order limit
    if (limitsApply) {
      const limitCheck = checkLimit('orders_per_day');
      if (!limitCheck.allowed) {
        toast.error('Daily Order Limit Reached', { description: limitCheck.message });
        return;
      }
    }

    setLoading(true);
    try {
      const { subtotal, tax, discount, total } = calculateTotals();

      if (paymentMethod === 'cash' && cashTendered && parseFloat(cashTendered) < total) {
        toast.error('Insufficient cash tendered');
        setLoading(false);
        return;
      }

      // Prepare transaction items
      const transactionItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.subtotal,
        category: item.category,
        stock_quantity: item.stock_quantity
      }));

      // Try atomic RPC first
      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_pos_transaction_atomic', {
        p_tenant_id: tenantId,
        p_items: transactionItems,
        p_payment_method: paymentMethod,
        p_subtotal: subtotal,
        p_tax_amount: tax,
        p_discount_amount: discount,
        p_customer_id: selectedCustomer?.id || null,
        p_shift_id: null
      });

      let transactionId: string | null = null;
      let transactionNumber: string;

      if (rpcError) {
        // Fallback logic
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
          transactionNumber = `POS-${Date.now().toString(36).toUpperCase()}`;
          const { data: transaction, error: transactionError } = await supabase
            .from('pos_transactions')
            .insert({
              tenant_id: tenantId,
              transaction_number: transactionNumber,
              customer_id: selectedCustomer?.id || null,
              items: transactionItems,
              subtotal: subtotal,
              tax_amount: tax,
              discount_amount: discount,
              total_amount: total,
              payment_method: paymentMethod,
              payment_status: 'completed',
              status: 'completed',
              notes: selectedCustomer ? `Customer: ${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Walk-in customer'
            })
            .select()
            .maybeSingle();

          if (transactionError) throw transactionError;
          transactionId = transaction?.id;

          // Update inventory
          for (const item of cart) {
            await supabase
              .from('products')
              .update({ stock_quantity: item.stock_quantity - item.quantity })
              .eq('id', item.id)
              .eq('tenant_id', tenantId);
          }

          // Invalidate dashboard stats so Low Stock KPI updates
          if (tenantId) {
            invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenantId);
          }

          // Update loyalty
          if (selectedCustomer) {
            const pointsEarned = Math.floor(total);
            await supabase
              .from('customers')
              .update({ loyalty_points: (selectedCustomer.loyalty_points ?? 0) + pointsEarned })
              .eq('id', selectedCustomer.id)
              .eq('tenant_id', tenantId);
          }
        } else {
          throw rpcError;
        }
      } else {
        const result = rpcResult as { success: boolean; transaction_id: string; transaction_number: string; total: number };
        transactionId = result.transaction_id;
        transactionNumber = result.transaction_number;
      }

      // Log activity
      for (const item of cart) {
        await logActivityAuto(
          tenantId,
          ActivityActions.UPDATE_INVENTORY,
          'product',
          item.id,
          {
            quantity_sold: item.quantity,
            previous_stock: item.stock_quantity,
            new_stock: item.stock_quantity - item.quantity,
            pos_transaction_id: transactionId
          }
        );
      }

      await logActivityAuto(
        tenantId,
        ActivityActions.COMPLETE_ORDER,
        'pos_transaction',
        transactionId,
        {
          transaction_number: transactionNumber,
          total,
          subtotal,
          tax,
          discount,
          item_count: cart.length,
          payment_method: paymentMethod,
          customer_id: selectedCustomer?.id
        }
      );

      // Link pending order
      if (activeOrderId && tenantId) {
        await supabase
          .from('disposable_menu_orders')
          .update({
            status: 'completed',
            pos_transaction_id: transactionId,
            completed_at: new Date().toISOString()
          })
          .eq('id', activeOrderId)
          .eq('tenant_id', tenantId);
      }

      if (limitsApply) {
        await recordAction('order');
      }

      // Calculate change
      let changeMsg = '';
      if (paymentMethod === 'cash' && cashTendered) {
        const change = parseFloat(cashTendered) - total;
        if (change >= 0) {
          changeMsg = ` | Change Due: ${formatCurrency(change)}`;
        }
      }

      toast.success('Sale completed!', { description: `Transaction ${transactionNumber}${changeMsg}` });

      clearCart();
      loadProducts();
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    } catch (error) {
      logger.error('Error completing sale', error, { component: 'PointOfSale', tenantId });
      toast.error('Error completing sale', { description: humanizeError(error, 'Unknown error') });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadOrder = (order: PendingOrder) => {
    if (cart.length > 0) {
      setPendingLoadOrder(order);
      confirm({
        title: 'Clear Current Cart?',
        description: 'Loading this order will clear your current cart. Continue?',
        onConfirm: () => executeLoadOrder(order),
      });
    } else {
      executeLoadOrder(order);
    }
  };

  const executeLoadOrder = async (order: PendingOrder) => {
    try {
      // Convert items
      const cartItems = order.items.map(item => ({
        id: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: 'flower',
        stock_quantity: 999, // Placeholder
        subtotal: Number(item.price) * Number(item.quantity),
        image_url: null,
        thc_percent: null
      }));

      await orderFlowManager.transitionOrderStatus(order.id, 'in_pos', tenantId!);
      setCart(cartItems as CartItem[]);
      if (order.customer_id) {
        const customer = customers.find(c => c.id === order.customer_id);
        if (customer) setSelectedCustomer(customer);
      }
      setActiveOrderId(order.id);
      setActiveTab('register');
      toast.success('Order loaded', { description: 'Pending order loaded into register' });
    } catch (error) {
      logger.error('Error loading order', error);
      toast.error('Failed to load order', { description: humanizeError(error) });
    } finally {
      setPendingLoadOrder(null);
      closeDialog();
    }
  };

  const handleCancelOrder = (order: PendingOrder) => {
    confirm({
      title: 'Cancel Order?',
      description: 'Are you sure you want to cancel this order? This action cannot be undone.',
      itemName: order.id.slice(0, 8),
      itemType: 'order',
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          await orderFlowManager.transitionOrderStatus(order.id, 'cancelled', tenantId!);
          toast.success('Order cancelled');
        } catch (error) {
          logger.error('Error cancelling order', error);
          toast.error('Failed to cancel order', { description: humanizeError(error) });
        } finally {
          setDialogLoading(false);
          closeDialog();
        }
      },
    });
  };

  const { subtotal, tax, discount, total } = calculateTotals();
  const categories = ['all', 'flower', 'edibles', 'concentrates', 'vapes', 'pre-rolls', 'topicals', 'gear'];

  const changeDue = paymentMethod === 'cash' && cashTendered
    ? Math.max(0, parseFloat(cashTendered) - total)
    : 0;

  return (
    <div className={cn(
      "bg-background transition-all duration-300",
      isFullScreen ? "fixed inset-0 z-modal p-4 flex flex-col h-dvh overflow-hidden" : "p-6 min-h-dvh"
    )}>
      <SEOHead title="Point of Sale | Admin" description="Process sales and manage transactions" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Point of Sale</h1>
          <Badge variant={activeOrderId ? "default" : "outline"} className="hidden sm:flex">
            {activeOrderId ? "Online Order Active" : "Walk-In Mode"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isFullScreen && (
            <Button variant="outline" onClick={() => navigateToAdmin('order-management')}>
              View History
            </Button>
          )}
          <Button
            variant={isFullScreen ? "secondary" : "outline"}
            size="icon"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Exit Full Screen (Esc)" : "Full Screen"}
            aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
          >
            {isFullScreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden h-full">

        {/* LEFT COLUMN - Product Catalog */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mb-4">
              <TabsTrigger value="register" className="px-6 py-2">Here & Now</TabsTrigger>
              <TabsTrigger value="pickups" className="px-6 py-2">Pending Pickups</TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="flex-1 flex flex-col min-h-0 data-[state=active]:flex">
              {/* Search & Categories */}
              <div className="space-y-4 mb-4 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    aria-label="Search products"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>

                <ScrollArea className="w-full whitespace-nowrap pb-2">
                  <div className="flex space-x-2">
                    {categories.map(cat => (
                      <Button
                        key={cat}
                        variant={categoryFilter === cat ? "default" : "outline"}
                        onClick={() => setCategoryFilter(cat)}
                        className="rounded-full px-6 h-10 capitalize"
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              {/* Product Grid - Scrollable */}
              <ScrollArea className="flex-1 -mr-4 pr-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                  {filteredProducts.map(product => (
                    <Card
                      key={product.id}
                      className={cn(
                        "cursor-pointer hover:border-primary transition-all active:scale-[0.98] group relative overflow-hidden",
                        "h-full flex flex-col"
                      )}
                      onClick={() => addToCart(product)}
                    >
                      <div className="aspect-[4/3] bg-muted relative">
                        {product.image_url && !failedImages.has(product.id) ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={() => handleImageError(product.id)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted/50">
                            <ShoppingCart className="w-12 h-12 text-muted-foreground/30" />
                          </div>
                        )}
                        {product.stock_quantity === 0 && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center font-bold text-destructive">
                            OUT OF STOCK
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          {product.thc_percent && (
                            <Badge variant="secondary" className="bg-background/80 backdrop-blur font-mono">
                              {product.thc_percent}% THC
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-3 flex flex-col flex-1">
                        <h3 className="font-semibold text-base line-clamp-2 leading-tight mb-2 flex-1">{product.name}</h3>
                        <div className="flex items-end justify-between mt-auto">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{product.stock_quantity} left</span>
                            <span className="text-lg font-bold text-primary">${product.price}</span>
                          </div>
                          <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full p-0" aria-label="Add to cart">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {filteredProducts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                      No products found.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pickups" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1">
                {tenantId && (
                  <PendingPickupsPanel
                    tenantId={tenantId}
                    onLoadOrder={handleLoadOrder}
                    onCancelOrder={handleCancelOrder}
                  />
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT COLUMN - Cart */}
        <div className={cn(
          "flex flex-col border-l pl-6 transition-all duration-300",
          isFullScreen ? "w-[400px] xl:w-[450px]" : "w-[350px] lg:w-[380px]"
        )}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Current Order
            </h2>
            <Button variant="ghost" size="sm" onClick={clearCart} disabled={cart.length === 0} className="text-destructive hover:text-destructive">
              Clear
            </Button>
          </div>

          {/* Customer Selector */}
          <div className="mb-4 space-y-2 flex-shrink-0">
            <Select
              value={selectedCustomer?.id || 'walk-in'}
              onValueChange={(value) => {
                if (value === 'walk-in') {
                  setSelectedCustomer(null);
                } else {
                  const customer = customers.find(c => c.id === value);
                  setSelectedCustomer(customer || null);
                }
              }}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {customersLoading ? (
                  <SelectItem value="_loading" disabled>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading customers...
                    </span>
                  </SelectItem>
                ) : customersError ? (
                  <SelectItem value="_error" disabled>
                    <span className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Failed to load customers
                    </span>
                  </SelectItem>
                ) : customers.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    <span className="text-muted-foreground">No customers yet</span>
                  </SelectItem>
                ) : (
                  customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name}
                      {customer.customer_type === 'medical' && <Badge className="ml-2" variant="secondary">Med</Badge>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedCustomer && (
              <div className="flex justify-between items-center px-2 text-sm text-muted-foreground">
                <span>Verified Customer</span>
                <span>Points: {selectedCustomer.loyalty_points}</span>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-2">
            <ScrollArea className="flex-1 bg-muted/10">
              <div className="p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <ShoppingCart className="h-10 w-10 mb-2" />
                    <p>Scan or select items</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-2 p-2 bg-background rounded-lg border shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium line-clamp-1">{item.name}</div>
                        <div className="text-sm text-muted-foreground">${item.price}</div>
                      </div>
                      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                        <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => updateQuantity(item.id, -1)} aria-label="Decrease quantity">
                          {item.quantity === 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => updateQuantity(item.id, 1)} aria-label="Increase quantity">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="font-mono font-medium min-w-[3rem] text-right pt-[0.15rem]">
                        {formatCurrency(item.subtotal)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Footer / Totals */}
            <div className="p-4 bg-background border-t space-y-4 shadow-xl z-10">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (8.875%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Discount</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-2xl font-bold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-2">
                {['cash', 'credit', 'debit', 'other'].map(method => (
                  <Button
                    key={method}
                    variant={paymentMethod === method ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method}
                  </Button>
                ))}
              </div>

              {/* Cash Calculator */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2 bg-muted/30 p-2 rounded-md border">
                  <div className="flex gap-2 items-center">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input
                      className="h-9 font-mono"
                      placeholder="Amount Tendered"
                      aria-label="Cash amount tendered"
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                    />
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between items-center px-1">
                      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Change Due</span>
                      <span className="text-xl font-bold font-mono text-green-600">{formatCurrency(changeDue)}</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                size="lg"
                className="w-full text-lg h-14 font-bold shadow-lg"
                onClick={completeSale}
                disabled={cart.length === 0 || loading || (paymentMethod === 'cash' && !!cashTendered && parseFloat(cashTendered) < total)}
              >
                {loading ? 'Processing...' : `Charge ${formatCurrency(total)}`}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuickMenuOpen(true)}>
                  <Share2 className="h-3 w-3 mr-2" /> Share
                </Button>
                <Button variant="outline" size="sm" onClick={clearCart} disabled={cart.length === 0} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {tenantId && (
        <QuickMenuWizard
          open={quickMenuOpen}
          onOpenChange={setQuickMenuOpen}
          cartItems={cart}
          tenantId={tenantId}
        />
      )}

      <ConfirmDeleteDialog
        open={dialogState.open}
        onOpenChange={(open) => !open && closeDialog()}
        title={dialogState.title}
        description={dialogState.description}
        itemName={dialogState.itemName}
        itemType={dialogState.itemType}
        onConfirm={dialogState.onConfirm}
        isLoading={dialogState.isLoading}
      />
    </div>
  );
}
