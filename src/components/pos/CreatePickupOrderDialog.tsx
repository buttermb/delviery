/**
 * CreatePickupOrderDialog Component
 * 
 * Allows creating a pending pickup order directly from POS.
 * Customer arrives, places order, pays later when they pick up.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Plus, Minus, Trash2, ShoppingBag, User, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Product, CartItem } from '@/pages/admin/PointOfSale';

interface CreatePickupOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenantId: string;
    products: Product[];
    onOrderCreated: () => void;
}

interface Customer {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
}

export function CreatePickupOrderDialog({
    open,
    onOpenChange,
    tenantId,
    products,
    onOrderCreated,
}: CreatePickupOrderDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [newCustomer, setNewCustomer] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
    });
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [pickupTime, setPickupTime] = useState('');

    // Load customers
    useEffect(() => {
        if (!tenantId) return;
        loadCustomers();
    }, [tenantId]);

    const loadCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, first_name, last_name, email, phone')
                .eq('tenant_id', tenantId)
                .order('first_name');

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            logger.error('Error loading customers', error);
        }
    };

    // Filter products
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        p.stock_quantity > 0
    );

    // Filter customers
    const filteredCustomers = customers.filter(c => {
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
        const email = c.email?.toLowerCase() || '';
        const query = customerSearch.toLowerCase();
        return fullName.includes(query) || email.includes(query);
    });

    // Add to cart
    const addToCart = (product: Product) => {
        const existing = cart.find(item => item.id === product.id);

        if (existing) {
            if (existing.quantity >= product.stock_quantity) {
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

    // Update quantity
    const updateQuantity = (productId: string, change: number) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(1, Math.min(item.stock_quantity, item.quantity + change));
                return { ...item, quantity: newQty, subtotal: newQty * item.price };
            }
            return item;
        }));
    };

    // Remove from cart
    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.08875;
    const total = subtotal + tax;

    // Create new customer
    const createCustomer = async (): Promise<string | null> => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .insert({
                    tenant_id: tenantId,
                    first_name: newCustomer.firstName,
                    last_name: newCustomer.lastName,
                    email: newCustomer.email || null,
                    phone: newCustomer.phone || null,
                    customer_type: 'recreational',
                })
                .select('id')
                .single();

            if (error) throw error;
            return data?.id || null;
        } catch (error) {
            logger.error('Error creating customer', error);
            toast({ title: 'Failed to create customer', variant: 'destructive' });
            return null;
        }
    };

    // Create pickup order
    const createOrder = async () => {
        if (cart.length === 0) {
            toast({ title: 'Cart is empty', variant: 'destructive' });
            return;
        }

        if (!selectedCustomer && !newCustomer.firstName) {
            toast({ title: 'Please select or add a customer', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            // Create customer if needed
            let customerId = selectedCustomer?.id;
            if (!customerId && newCustomer.firstName) {
                customerId = await createCustomer();
                if (!customerId) return;
            }

            // Prepare order items
            const orderItems = cart.map(item => ({
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.subtotal,
            }));

            // Generate order number
            const orderNumber = `PU-${Date.now().toString(36).toUpperCase()}`;

            // Create the order
            // @ts-ignore - Table not in generated types
            const { data: order, error } = await supabase
                .from('disposable_menu_orders')
                .insert({
                    tenant_id: tenantId,
                    customer_id: customerId,
                    order_number: orderNumber,
                    items: orderItems,
                    subtotal: subtotal,
                    tax_amount: tax,
                    total_amount: total,
                    status: 'ready_for_pickup',
                    order_type: 'pickup',
                    pickup_time: pickupTime || null,
                    notes: `Pickup order created from POS`,
                })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: 'Pickup order created!',
                description: `Order ${orderNumber} is ready for pickup`,
            });

            // Reset form
            setCart([]);
            setSelectedCustomer(null);
            setNewCustomer({ firstName: '', lastName: '', email: '', phone: '' });
            setShowNewCustomerForm(false);
            setPickupTime('');

            onOrderCreated();
            onOpenChange(false);
        } catch (error) {
            logger.error('Error creating pickup order', error);
            toast({
                title: 'Failed to create order',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        Create Pickup Order
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
                    {/* Left: Products */}
                    <div className="flex flex-col space-y-3 overflow-hidden">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            <div className="grid grid-cols-2 gap-2 pb-4">
                                {filteredProducts.slice(0, 20).map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="font-medium text-sm truncate">{product.name}</div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-sm font-bold">${product.price.toFixed(2)}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {product.stock_quantity} left
                                            </Badge>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Cart & Customer */}
                    <div className="flex flex-col space-y-3 overflow-hidden border-l pl-4">
                        {/* Customer Selection */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Customer
                            </Label>

                            {selectedCustomer ? (
                                <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                                    <span className="font-medium">
                                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedCustomer(null)}
                                    >
                                        Change
                                    </Button>
                                </div>
                            ) : showNewCustomerForm ? (
                                <div className="space-y-2 p-3 border rounded-lg">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="First name *"
                                            value={newCustomer.firstName}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Last name"
                                            value={newCustomer.lastName}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                                        />
                                    </div>
                                    <Input
                                        placeholder="Phone"
                                        value={newCustomer.phone}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => setShowNewCustomerForm(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Input
                                        placeholder="Search customers..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                    />
                                    {customerSearch && filteredCustomers.length > 0 && (
                                        <ScrollArea className="max-h-32 border rounded-lg">
                                            {filteredCustomers.slice(0, 5).map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        setSelectedCustomer(c);
                                                        setCustomerSearch('');
                                                    }}
                                                    className="w-full p-2 text-left hover:bg-muted text-sm"
                                                >
                                                    {c.first_name} {c.last_name}
                                                    {c.email && <span className="text-muted-foreground ml-2">{c.email}</span>}
                                                </button>
                                            ))}
                                        </ScrollArea>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => setShowNewCustomerForm(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        New Customer
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Pickup Time */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Pickup Time (optional)
                            </Label>
                            <Input
                                type="time"
                                value={pickupTime}
                                onChange={(e) => setPickupTime(e.target.value)}
                            />
                        </div>

                        <Separator />

                        {/* Cart Items */}
                        <ScrollArea className="flex-1 -mx-2 px-2">
                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Add products to the order
                                </div>
                            ) : (
                                <div className="space-y-2 pb-4">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{item.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    ${item.price.toFixed(2)} each
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <span className="font-bold text-sm w-16 text-right">
                                                ${item.subtotal.toFixed(2)}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => removeFromCart(item.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Totals */}
                        {cart.length > 0 && (
                            <div className="space-y-1 text-sm border-t pt-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tax (8.875%)</span>
                                    <span>${tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={createOrder}
                        disabled={loading || cart.length === 0}
                    >
                        {loading ? 'Creating...' : 'Create Pickup Order'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default CreatePickupOrderDialog;
