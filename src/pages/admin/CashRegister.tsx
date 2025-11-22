import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, DollarSign, CreditCard, Search, Plus, Minus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryKeys } from '@/lib/queryKeys';

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

export default function CashRegister() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Load products
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.pos.products(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity, image_url')
        .eq('tenant_id', tenantId)
        .gt('stock_quantity', 0);
      
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

  // Process payment mutation
  const processPayment = useMutation({
    mutationFn: async () => {
      if (!tenantId || cart.length === 0) throw new Error('Invalid transaction');

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      // Create POS transaction
      const { error: txError } = await supabase
        .from('pos_transactions' as any)
        .insert({
          tenant_id: tenantId,
          total_amount: total,
          payment_method: paymentMethod,
          payment_status: 'completed',
          items: cart.map(item => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal
          }))
        });

      if (txError) throw txError;

      // Update inventory
      for (const item of cart) {
        const { error: invError } = await supabase
          .from('products')
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq('id', item.id);
        
        if (invError) throw invError;
      }
    },
    onSuccess: () => {
      toast({ title: 'Payment processed successfully!' });
      setCart([]);
      setPaymentMethod('cash');
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.transactions(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.products(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
    onError: (error: unknown) => {
      logger.error('Payment processing failed', error, { component: 'CashRegister' });
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast({ title: 'Not enough stock', variant: 'destructive' });
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
    setProductDialogOpen(false);
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

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading cash register...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cash Register</h1>
        <p className="text-muted-foreground">Point of sale transaction management</p>
      </div>

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
            {cart.length > 0 && (
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
                onClick={() => setProductDialogOpen(true)}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Button
                className="flex-1"
                variant="default"
                onClick={() => processPayment.mutate()}
                disabled={cart.length === 0 || processPayment.isPending}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {processPayment.isPending ? 'Processing...' : 'Process Payment'}
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
              {filteredProducts.map(product => (
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
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
