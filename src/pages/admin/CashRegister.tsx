import { logger } from '@/lib/logger';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, DollarSign, CreditCard, Search, Plus, Minus, Trash2, WifiOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryKeys } from '@/lib/queryKeys';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { queueAction } from '@/lib/offlineQueue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url: string | null;
}

interface CartItem extends Product {
  quantity: number;
  subtotal: number;
}

interface InsufficientStockItem {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
}

interface POSTransactionResult {
  success: boolean;
  transaction_id?: string;
  transaction_number?: string;
  total?: number;
  items_count?: number;
  payment_method?: string;
  created_at?: string;
  error?: string;
  error_code?: 'NEGATIVE_TOTAL' | 'EMPTY_CART' | 'INVALID_QUANTITY' | 'PRODUCT_NOT_FOUND' | 'INSUFFICIENT_STOCK' | 'TRANSACTION_FAILED';
  insufficient_items?: InsufficientStockItem[];
}

function CashRegisterContent() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { triggerSuccess, triggerLight, triggerError } = useHapticFeedback();
  const { execute: executeCreditAction } = useCreditGatedAction();
  const { isOnline, pendingCount } = useOfflineQueue();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isAddingToCart, setIsAddingToCart] = useState<string | null>(null);

  // Load products
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.pos.products(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity, image_url')
        .eq('tenant_id', tenantId);
      // .gt('stock_quantity', 0); // Allow seeing all products even if out of stock

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Load recent transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: queryKeys.pos.transactions(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('pos_transactions' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Queue transaction for offline processing
  const queueOfflineTransaction = useCallback(async (items: CartItem[], total: number) => {
    if (!tenantId) return;

    const payload = {
      p_tenant_id: tenantId,
      p_items: items.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        price_at_order_time: item.price,
        total_price: item.subtotal,
        stock_quantity: item.stock_quantity
      })),
      p_payment_method: paymentMethod,
      p_subtotal: total,
      p_tax_amount: 0,
      p_discount_amount: 0,
      p_customer_id: null,
      p_shift_id: null
    };

    await queueAction(
      'generic',
      `/api/pos/transaction`, // This would be the edge function endpoint
      'POST',
      payload,
      3
    );

    toast({
      title: 'Transaction queued',
      description: 'Will be processed when connection is restored.'
    });
    setCart([]);
    setPaymentMethod('cash');
  }, [tenantId, paymentMethod, toast]);

  // Process payment mutation - uses atomic RPC only
  const processPayment = useMutation({
    mutationFn: async (): Promise<POSTransactionResult> => {
      if (!tenantId || cart.length === 0) {
        throw new Error('Invalid transaction: No items in cart');
      }

      // Check online status - queue if offline
      if (!isOnline) {
        const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
        await queueOfflineTransaction(cart, total);
        return { success: true, transaction_number: 'QUEUED' };
      }

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      // Prepare items for RPC with price snapshot
      const items = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        price_at_order_time: item.price,
        total_price: item.subtotal,
        stock_quantity: item.stock_quantity
      }));

      // Use atomic RPC - prevents race conditions on inventory
      // @ts-expect-error RPC function not in auto-generated types
      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_pos_transaction_atomic', {
        p_tenant_id: tenantId,
        p_items: items,
        p_payment_method: paymentMethod,
        p_subtotal: total,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null
      });

      if (rpcError) {
        logger.error('POS transaction RPC failed', rpcError, { component: 'CashRegister' });

        // Check for specific error types
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('does not exist')) {
          throw new Error('POS system not configured. Please contact support.');
        }

        // Extract meaningful error message
        const errorMessage = rpcError.message?.includes('Insufficient stock')
          ? rpcError.message
          : rpcError.message || 'Transaction failed. Please try again.';

        throw new Error(errorMessage);
      }

      const result = rpcResult as POSTransactionResult;

      if (!result.success) {
        // Handle specific error codes with user-friendly messages
        if (result.error_code === 'INSUFFICIENT_STOCK' && result.insufficient_items) {
          const stockDetails = result.insufficient_items.map((item: InsufficientStockItem) =>
            `${item.product_name}: need ${item.requested}, have ${item.available}`
          ).join('\n');
          throw new Error(`Insufficient stock:\n${stockDetails}`);
        }
        throw new Error(result.error || 'Transaction failed');
      }

      return result;
    },
    onSuccess: (result) => {
      triggerSuccess();

      if (result.transaction_number === 'QUEUED') {
        // Already handled in queueOfflineTransaction
        return;
      }

      toast({
        title: 'Payment processed successfully!',
        description: `Transaction ${result.transaction_number}`
      });
      setCart([]);
      setPaymentMethod('cash');
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.transactions(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.products(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
    onError: (error: unknown) => {
      triggerError();
      logger.error('Payment processing failed', error, { component: 'CashRegister' });
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  const addToCart = useCallback((product: Product) => {
    setIsAddingToCart(product.id);

    try {
      const existingItem = cart.find(item => item.id === product.id);

      if (existingItem) {
        if (existingItem.quantity >= product.stock_quantity) {
          triggerError();
          toast({ title: 'Not enough stock', variant: 'destructive' });
          return;
        }
        triggerLight();
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        ));
      } else {
        if (product.stock_quantity <= 0) {
          triggerError();
          toast({ title: 'Product out of stock', variant: 'destructive' });
          return;
        }
        triggerLight();
        setCart([...cart, { ...product, quantity: 1, subtotal: product.price }]);
      }
      setProductDialogOpen(false);
    } finally {
      // Small delay for visual feedback
      setTimeout(() => setIsAddingToCart(null), 150);
    }
  }, [cart, triggerError, triggerLight, toast]);

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = Math.max(1, Math.min(item.stock_quantity, item.quantity + change));
        return { ...item, quantity: newQuantity, subtotal: newQuantity * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        {/* Quick Add skeleton */}
        <Card className="bg-gradient-to-r from-primary/5 to-background">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-24 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Main content skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Offline Alert */}
      {!isOnline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>You are offline</AlertTitle>
          <AlertDescription>
            Transactions will be queued and processed when connection is restored.
            {pendingCount > 0 && ` (${pendingCount} pending)`}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary" />
            Cash Register
            {!isOnline && <WifiOff className="h-5 w-5 text-destructive" />}
          </h1>
          <p className="text-muted-foreground">Point of sale transaction management</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Space</kbd> to add item
        </div>
      </div>

      {/* Quick Add Section */}
      {products.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Quick Add
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {products.slice(0, 8).map((product) => (
                <Button
                  key={product.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addToCart(product)}
                  disabled={product.stock_quantity <= 0 || isAddingToCart === product.id}
                  className="h-auto py-2 px-3 flex flex-col items-start gap-0.5 min-w-[100px] hover:border-primary hover:bg-primary/5"
                >
                  {isAddingToCart === product.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className="font-medium text-xs truncate max-w-[80px]">{product.name}</span>
                      <span className="text-xs text-muted-foreground">${product.price}</span>
                    </>
                  )}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProductDialogOpen(true)}
                className="h-auto py-2 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                More...
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Total</div>
              <div className="text-3xl font-bold">${total.toFixed(2)}</div>
            </div>

            {/* Cart Items */}
            {cart.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-auto">
                <div className="text-sm font-medium">Items</div>
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ${item.price} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <span className="font-bold text-sm">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg border-muted-foreground/25">
                <ShoppingCart className="w-12 h-12 mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">Your cart is empty</p>
                <p className="text-xs text-muted-foreground mt-1">Add items to start a transaction</p>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="text-sm font-medium mb-2 block">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="debit">Debit Card</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setProductDialogOpen(true)}
                disabled={processPayment.isPending}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Button
                className="flex-1"
                variant="default"
                onClick={async () => {
                  await executeCreditAction('pos_process_sale', async () => {
                    await processPayment.mutateAsync();
                  });
                }}
                disabled={cart.length === 0 || processPayment.isPending}
              >
                {processPayment.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    {!isOnline ? 'Queue Payment' : 'Process Payment'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest POS transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Transaction #{transaction.id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold">${(transaction.total_amount || 0).toFixed(2)}</div>
                      <Badge variant={transaction.payment_status === 'completed' ? 'default' : 'secondary'}>
                        {transaction.payment_status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-2 text-center py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground font-medium mb-2">
                    {products.length === 0
                      ? "No products available"
                      : searchQuery
                        ? "No products match your search"
                        : "No products with stock"}
                  </p>
                  {products.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Add products with stock to start selling
                    </p>
                  )}
                  {products.length > 0 && !searchQuery && (
                    <p className="text-sm text-muted-foreground mb-4">
                      All products are out of stock. Update inventory to continue.
                    </p>
                  )}
                </div>
              ) : (
                filteredProducts.map(product => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-3">
                      <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">${product.price}</span>
                        <span className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export with error boundary wrapper for crash recovery
export function CashRegister() {
  return (
    <AdminErrorBoundary>
      <CashRegisterContent />
    </AdminErrorBoundary>
  );
}
