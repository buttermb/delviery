import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Search, ShoppingCart, Trash2, Plus, Minus, DollarSign, CreditCard } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { logActivityAuto, ActivityActions } from '@/lib/activityLogger';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock_quantity: number;
  thc_percent: number | null;
  image_url: string | null;
}

interface CartItem extends Product {
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
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { toast } = useToast();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [loading, setLoading] = useState(false);

  // Enable realtime sync for wholesale_orders and wholesale_inventory
  useRealtimeSync({
    tenantId,
    tables: ['wholesale_orders', 'wholesale_inventory'],
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (tenantId) {
      loadProducts();
      loadCustomers();
    }
  }, [tenantId]);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, categoryFilter, products]);

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
      const mappedProducts: Product[] = (data || []).map((p) => ({
        id: p.id,
        name: p.name || '',
        price: typeof p.price === 'number' ? p.price : 0,
        category: p.category || null,
        stock_quantity: typeof p.stock_quantity === 'number' ? p.stock_quantity : 0,
        thc_percent: typeof p.thc_percent === 'number' ? p.thc_percent : null,
        image_url: p.image_url || null
      }));

      setProducts(mappedProducts);
    } catch (error) {
      logger.error('Error loading products', error);
      toast({ title: 'Error loading products', variant: 'destructive' });
    }
  };

  const loadCustomers = async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, customer_type, loyalty_points')
        .eq('tenant_id', tenantId) // FIX: Add tenant isolation
        .order('first_name');

      if (error) throw error;

      // Map to our Customer interface with proper type checking
      const mappedCustomers: Customer[] = (data || []).map((c) => ({
        id: c.id,
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        customer_type: c.customer_type || null,
        loyalty_points: typeof c.loyalty_points === 'number' ? c.loyalty_points : 0
      }));

      setCustomers(mappedCustomers);
    } catch (error) {
      logger.error('Error loading customers', error, { component: 'PointOfSale', tenantId });
    }
  };

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

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPaymentMethod('cash');
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
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }

    if (!tenantId) {
      toast({ title: 'Tenant not loaded', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { subtotal, tax, discount, total } = calculateTotals();

      // Generate transaction number
      const transactionNumber = `POS-${Date.now().toString(36).toUpperCase()}`;

      // 1. Create POS transaction record FIRST
      const transactionItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.subtotal,
        category: item.category
      }));

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
        } as any)
        .select()
        .single();

      if (transactionError) {
        logger.error('Error creating POS transaction', transactionError, { component: 'PointOfSale' });
        throw transactionError;
      }

      logger.info('POS transaction created', {
        transactionId: transaction?.id,
        transactionNumber,
        total,
        component: 'PointOfSale'
      });

      // 2. Update inventory for each item
      for (const item of cart) {
        const { error } = await supabase
          .from('products')
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq('id', item.id);

        if (error) throw error;

        // Log inventory update activity
        await logActivityAuto(
          tenantId,
          ActivityActions.UPDATE_INVENTORY,
          'product',
          item.id,
          {
            quantity_sold: item.quantity,
            previous_stock: item.stock_quantity,
            new_stock: item.stock_quantity - item.quantity,
            pos_transaction_id: transaction?.id
          }
        );
      }

      // 3. Log sale completion activity
      await logActivityAuto(
        tenantId,
        ActivityActions.COMPLETE_ORDER,
        'pos_transaction',
        transaction?.id,
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

      // 4. Update customer loyalty points if applicable
      if (selectedCustomer) {
        const pointsEarned = Math.floor(total); // 1 point per dollar
        await supabase
          .from('customers')
          .update({
            loyalty_points: (selectedCustomer.loyalty_points || 0) + pointsEarned
          })
          .eq('id', selectedCustomer.id);
      }

      toast({
        title: 'Sale completed!',
        description: `Transaction ${transactionNumber} - Total: $${total.toFixed(2)}`
      });

      clearCart();
      loadProducts();
      loadCustomers(); // Refresh customer loyalty points
    } catch (error) {
      logger.error('Error completing sale', error, { component: 'PointOfSale', tenantId });
      toast({
        title: 'Error completing sale',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax, discount, total } = calculateTotals();
  const categories = ['all', 'flower', 'edibles', 'concentrates', 'vapes', 'pre-rolls', 'topicals'];

  return (
    <div className="min-h-screen bg-background p-6">
      <SEOHead title="Point of Sale | Admin" description="Process sales and manage transactions" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">Process in-store sales</p>
        </div>
        <Button variant="outline" onClick={() => navigateToAdmin('order-management')}>
          View Order History
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-4">
                  <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" loading="lazy" />
                    ) : (
                      <ShoppingCart className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">${product.price}</span>
                    {product.thc_percent && (
                      <Badge variant="secondary">{product.thc_percent}% THC</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Stock: {product.stock_quantity}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Customer</label>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name}
                        {customer.customer_type === 'medical' && <Badge className="ml-2" variant="secondary">Medical</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Loyalty Points: {selectedCustomer.loyalty_points || 0}
                  </p>
                )}
              </div>

              <Separator />

              {/* Cart Items */}
              <div className="space-y-3 max-h-96 overflow-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Cart is empty</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-muted-foreground">${item.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, -1);
                          }}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, 1);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (8.875%):</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Medical Discount (5%):</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium mb-2 block">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Cash
                      </div>
                    </SelectItem>
                    <SelectItem value="debit">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Debit Card
                      </div>
                    </SelectItem>
                    <SelectItem value="credit">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Credit Card
                      </div>
                    </SelectItem>
                    <SelectItem value="other">Other (Venmo, Zelle, etc)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={completeSale}
                  disabled={cart.length === 0 || loading}
                >
                  {loading ? 'Processing...' : 'Complete Sale'}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Clear Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
