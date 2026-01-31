/**
 * MobilePOS Component
 * 
 * Mobile-optimized Point of Sale with tabbed interface.
 * Features:
 * - Bottom tab navigation (Products/Cart)
 * - Single column product grid
 * - Swipe-friendly cart
 * - Large touch targets (48px minimum)
 * - Floating cart badge
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
    Search, ShoppingCart, Plus, Minus, Trash2,
    DollarSign, CreditCard, Banknote, Smartphone,
    ChevronLeft, X, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/utils/mobile';
import { Product, CartItem } from '@/pages/admin/PointOfSale';

interface MobilePOSProps {
    products: Product[];
    cart: CartItem[];
    onAddToCart: (product: Product) => void;
    onUpdateQuantity: (productId: string, change: number) => void;
    onRemoveFromCart: (productId: string) => void;
    onClearCart: () => void;
    onCompleteSale: () => void;
    loading: boolean;
    totals: {
        subtotal: number;
        tax: number;
        discount: number;
        total: number;
    };
    paymentMethod: string;
    onPaymentMethodChange: (method: string) => void;
    cashTendered: string;
    onCashTenderedChange: (value: string) => void;
    categories: string[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    categoryFilter: string;
    onCategoryChange: (category: string) => void;
}

type MobileTab = 'products' | 'cart';

export function MobilePOS({
    products,
    cart,
    onAddToCart,
    onUpdateQuantity,
    onRemoveFromCart,
    onClearCart,
    onCompleteSale,
    loading,
    totals,
    paymentMethod,
    onPaymentMethodChange,
    cashTendered,
    onCashTenderedChange,
    categories,
    searchQuery,
    onSearchChange,
    categoryFilter,
    onCategoryChange,
}: MobilePOSProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<MobileTab>('products');
    const [showPayment, setShowPayment] = useState(false);

    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const changeDue = paymentMethod === 'cash' && cashTendered
        ? Math.max(0, parseFloat(cashTendered) - totals.total)
        : 0;

    const handleAddProduct = useCallback((product: Product) => {
        triggerHaptic('light');
        onAddToCart(product);
        // Show brief feedback
        toast({
            title: `Added ${product.name}`,
            duration: 1000,
        });
    }, [onAddToCart, toast]);

    const handleQuantityChange = useCallback((productId: string, change: number) => {
        triggerHaptic('light');
        onUpdateQuantity(productId, change);
    }, [onUpdateQuantity]);

    const handleRemove = useCallback((productId: string) => {
        triggerHaptic('medium');
        onRemoveFromCart(productId);
    }, [onRemoveFromCart]);

    const handleCheckout = useCallback(() => {
        if (cart.length === 0) {
            toast({ title: 'Cart is empty', variant: 'destructive' });
            return;
        }
        setShowPayment(true);
    }, [cart.length, toast]);

    const handleCompleteSale = useCallback(() => {
        triggerHaptic('success');
        onCompleteSale();
        setShowPayment(false);
        setActiveTab('products');
    }, [onCompleteSale]);

    // Render product card for mobile
    const renderProductCard = (product: Product) => (
        <Card
            key={product.id}
            className={cn(
                "active:scale-[0.98] transition-all touch-manipulation",
                product.stock_quantity === 0 && "opacity-50"
            )}
            onClick={() => product.stock_quantity > 0 && handleAddProduct(product)}
        >
            <CardContent className="p-4 flex items-center gap-4">
                {/* Product Image/Placeholder */}
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <ShoppingCart className="w-6 h-6 text-muted-foreground/40" />
                    )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base line-clamp-1">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold text-primary">${product.price}</span>
                        {product.thc_percent && (
                            <Badge variant="secondary" className="text-xs">
                                {product.thc_percent}% THC
                            </Badge>
                        )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                    </span>
                </div>

                {/* Add Button */}
                <Button
                    size="icon"
                    className="h-12 w-12 rounded-full flex-shrink-0"
                    disabled={product.stock_quantity === 0}
                >
                    <Plus className="h-5 w-5" />
                </Button>
            </CardContent>
        </Card>
    );

    // Render cart item for mobile
    const renderCartItem = (item: CartItem) => (
        <div key={item.id} className="flex items-center gap-3 p-4 bg-card rounded-lg border">
            {/* Item Info */}
            <div className="flex-1 min-w-0">
                <h3 className="font-semibold line-clamp-1">{item.name}</h3>
                <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                    onClick={() => item.quantity === 1 ? handleRemove(item.id) : handleQuantityChange(item.id, -1)}
                >
                    {item.quantity === 1 ? (
                        <Trash2 className="h-4 w-4 text-destructive" />
                    ) : (
                        <Minus className="h-4 w-4" />
                    )}
                </Button>
                <span className="w-8 text-center font-semibold text-lg">{item.quantity}</span>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                    onClick={() => handleQuantityChange(item.id, 1)}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Subtotal */}
            <div className="font-bold text-lg min-w-[60px] text-right">
                ${item.subtotal.toFixed(2)}
            </div>
        </div>
    );

    // Payment method buttons
    const paymentMethods = [
        { id: 'cash', label: 'Cash', icon: Banknote },
        { id: 'credit', label: 'Credit', icon: CreditCard },
        { id: 'debit', label: 'Debit', icon: CreditCard },
        { id: 'other', label: 'Other', icon: Smartphone },
    ];

    return (
        <div className="h-dvh flex flex-col bg-background">
            {/* Payment Overlay */}
            {showPayment && (
                <div className="fixed inset-0 bg-background z-50 flex flex-col">
                    {/* Payment Header */}
                    <div className="flex items-center gap-3 p-4 border-b safe-area-top">
                        <Button variant="ghost" size="icon" onClick={() => setShowPayment(false)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-xl font-bold">Payment</h1>
                    </div>

                    {/* Payment Content */}
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-6">
                            {/* Total Display */}
                            <div className="text-center py-6 bg-muted/30 rounded-xl">
                                <p className="text-muted-foreground mb-1">Total Due</p>
                                <p className="text-5xl font-bold">${totals.total.toFixed(2)}</p>
                            </div>

                            {/* Payment Methods */}
                            <div className="space-y-3">
                                <h2 className="font-semibold text-lg">Payment Method</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {paymentMethods.map(method => (
                                        <Button
                                            key={method.id}
                                            variant={paymentMethod === method.id ? "default" : "outline"}
                                            size="lg"
                                            className="h-16 flex-col gap-1"
                                            onClick={() => onPaymentMethodChange(method.id)}
                                        >
                                            <method.icon className="h-5 w-5" />
                                            <span>{method.label}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Cash Calculator */}
                            {paymentMethod === 'cash' && (
                                <div className="space-y-3">
                                    <h2 className="font-semibold text-lg">Cash Tendered</h2>
                                    <div className="flex gap-3 items-center">
                                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                                        <Input
                                            className="h-14 text-2xl font-mono text-center"
                                            placeholder="0.00"
                                            type="number"
                                            inputMode="decimal"
                                            value={cashTendered}
                                            onChange={(e) => onCashTenderedChange(e.target.value)}
                                        />
                                    </div>
                                    {changeDue > 0 && (
                                        <div className="bg-green-500/10 p-4 rounded-xl text-center">
                                            <p className="text-muted-foreground mb-1">Change Due</p>
                                            <p className="text-3xl font-bold text-green-600">${changeDue.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {/* Quick cash buttons */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[20, 50, 100, Math.ceil(totals.total)].map(amount => (
                                            <Button
                                                key={amount}
                                                variant="outline"
                                                className="h-12"
                                                onClick={() => onCashTenderedChange(amount.toString())}
                                            >
                                                ${amount}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Order Summary */}
                            <div className="space-y-2 text-base">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal ({cartItemCount} items)</span>
                                    <span>${totals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Tax</span>
                                    <span>${totals.tax.toFixed(2)}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Discount</span>
                                        <span>-${totals.discount.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Complete Sale Button */}
                    <div className="p-4 border-t safe-area-bottom">
                        <Button
                            size="lg"
                            className="w-full h-16 text-xl font-bold"
                            onClick={handleCompleteSale}
                            disabled={loading || (paymentMethod === 'cash' && cashTendered && parseFloat(cashTendered) < totals.total)}
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    <Check className="h-6 w-6 mr-2" />
                                    Complete Sale
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {activeTab === 'products' ? (
                <>
                    {/* Search & Filter Header */}
                    <div className="p-4 space-y-3 border-b safe-area-top">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-10 h-12 text-base"
                            />
                        </div>

                        {/* Category Pills */}
                        <ScrollArea className="w-full">
                            <div className="flex gap-2 pb-2">
                                {categories.map(cat => (
                                    <Button
                                        key={cat}
                                        variant={categoryFilter === cat ? "default" : "outline"}
                                        size="sm"
                                        className="rounded-full px-4 h-9 capitalize whitespace-nowrap"
                                        onClick={() => onCategoryChange(cat)}
                                    >
                                        {cat}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Product Grid */}
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-3 pb-24">
                            {products.map(renderProductCard)}
                            {products.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    No products found
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </>
            ) : (
                <>
                    {/* Cart Header */}
                    <div className="p-4 border-b flex items-center justify-between safe-area-top">
                        <h1 className="text-xl font-bold">Cart ({cartItemCount})</h1>
                        {cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={onClearCart} className="text-destructive">
                                Clear All
                            </Button>
                        )}
                    </div>

                    {/* Cart Items */}
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-3 pb-48">
                            {cart.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground">
                                    <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg">Cart is empty</p>
                                    <p className="text-sm">Add products to get started</p>
                                </div>
                            ) : (
                                cart.map(renderCartItem)
                            )}
                        </div>
                    </ScrollArea>

                    {/* Cart Footer / Totals */}
                    {cart.length > 0 && (
                        <div className="border-t bg-background p-4 space-y-4 safe-area-bottom">
                            <div className="space-y-2">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>${totals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Tax</span>
                                    <span>${totals.tax.toFixed(2)}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Discount</span>
                                        <span>-${totals.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-2xl font-bold">
                                    <span>Total</span>
                                    <span>${totals.total.toFixed(2)}</span>
                                </div>
                            </div>
                            <Button
                                size="lg"
                                className="w-full h-14 text-lg font-bold"
                                onClick={handleCheckout}
                            >
                                Checkout ${totals.total.toFixed(2)}
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t safe-area-bottom">
                <div className="flex">
                    <button
                        className={cn(
                            "flex-1 flex flex-col items-center py-3 gap-1 transition-colors",
                            activeTab === 'products' ? "text-primary" : "text-muted-foreground"
                        )}
                        onClick={() => setActiveTab('products')}
                    >
                        <Search className="h-6 w-6" />
                        <span className="text-xs font-medium">Products</span>
                    </button>
                    <button
                        className={cn(
                            "flex-1 flex flex-col items-center py-3 gap-1 transition-colors relative",
                            activeTab === 'cart' ? "text-primary" : "text-muted-foreground"
                        )}
                        onClick={() => setActiveTab('cart')}
                    >
                        <div className="relative">
                            <ShoppingCart className="h-6 w-6" />
                            {cartItemCount > 0 && (
                                <Badge
                                    className="absolute -top-2 -right-3 h-5 min-w-[20px] flex items-center justify-center text-xs p-0"
                                >
                                    {cartItemCount}
                                </Badge>
                            )}
                        </div>
                        <span className="text-xs font-medium">Cart</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MobilePOS;
