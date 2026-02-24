import { logger } from '@/lib/logger';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/hooks/useTenantNavigation';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    ArrowLeft,
    ArrowRight,
    Trash2,
    ShoppingCart,
    Search
} from 'lucide-react';
import { DisabledTooltip } from '@/components/shared/DisabledTooltip';
import { SmartVendorPicker } from '@/components/wholesale/SmartVendorPicker';
import { Vendor } from '@/hooks/useVendors';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

interface OrderProduct {
    id: string;
    name: string;
    qty: number;
    unitCost: number;
    expectedCost: number; // For display
    originalCost: number; // Original cost_per_unit from product for price change tracking
}

interface POData {
    vendor: Vendor | null;
    items: OrderProduct[];
    expectedDeliveryDate: string;
    notes: string;
}

export default function NewPurchaseOrder() {
    const { navigateToAdmin } = useTenantNavigation();
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    // Products for PO (All products, regardless of stock)
    const { data: allProducts = [] } = useQuery({
        queryKey: queryKeys.productsForPO.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];
            const { data, error } = await supabase
                .from('products')
                .select('id, name, cost_per_unit, stock_quantity, image_url')
                .eq('tenant_id', tenant.id)
                .order('name');

            if (error) throw error;
            return data.map(p => ({
                id: p.id,
                name: p.name,
                cost_per_unit: p.cost_per_unit || 0,
                stock: p.stock_quantity || 0,
                image_url: p.image_url
            }));
        },
        enabled: !!tenant?.id
    });

    const [step, setStep] = useState(1);
    const [poData, setPoData] = useState<POData>({
        vendor: null,
        items: [],
        expectedDeliveryDate: '',
        notes: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    // Step navigation
    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    // Item management
    const handleAddItem = (product: any) => {
        setPoData(prev => {
            if (prev.items.find(i => i.id === product.id)) {
                return {
                    ...prev,
                    items: prev.items.map(i =>
                        i.id === product.id ? { ...i, qty: i.qty + 1 } : i
                    )
                };
            }
            return {
                ...prev,
                items: [
                    ...prev.items,
                    {
                        id: product.id,
                        name: product.name,
                        qty: 1,
                        unitCost: product.cost_per_unit,
                        expectedCost: product.cost_per_unit,
                        originalCost: product.cost_per_unit
                    }
                ]
            };
        });
        setProductSearch(''); // Reset search after adding
    };

    const handleUpdateItem = (id: string, updates: Partial<OrderProduct>) => {
        setPoData(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i)
        }));
    };

    const handleRemoveItem = (id: string) => {
        setPoData(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== id)
        }));
    };

    // Calculations
    const totalAmount = useMemo(() => {
        return poData.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
    }, [poData.items]);

    // Submit Handler
    const handleSubmit = async () => {
        if (!poData.vendor || poData.items.length === 0 || !tenant?.id) return;

        setIsSubmitting(true);
        try {
            // 1. Create Purchase Order
            const poNumber = `PO-${format(new Date(), 'yyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

            const { data: po, error: poError } = await (supabase as any)
                .from('purchase_orders')
                .insert({
                    tenant_id: tenant.id,
                    vendor_id: poData.vendor.id,
                    po_number: poNumber,
                    status: 'ordered',
                    total: totalAmount,
                    expected_delivery_date: poData.expectedDeliveryDate || null,
                    notes: poData.notes || null
                })
                .select()
                .maybeSingle();

            if (poError) throw poError;

            // 2. Create Items
            const orderItems = poData.items.map(item => ({
                purchase_order_id: po.id,
                product_id: item.id,
                product_name: item.name || 'Unknown Product',
                quantity: item.qty,
                unit_cost: item.unitCost,
                total_cost: item.qty * item.unitCost,
            }));

            const { error: itemsError } = await (supabase as any)
                .from('purchase_order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 3. Log vendor price changes for items with different costs
            for (const item of poData.items) {
                if (item.unitCost !== item.originalCost) {
                    // Call the RPC to log vendor price change
                    await (supabase as any).rpc('log_vendor_price_change', {
                        p_product_id: item.id,
                        p_tenant_id: tenant.id,
                        p_vendor_id: poData.vendor.id,
                        p_cost_old: item.originalCost,
                        p_cost_new: item.unitCost,
                        p_changed_by: null,
                        p_reason: `Updated via PO ${poNumber}`,
                        p_source: 'purchase_order'
                    });

                    // Also update the product's cost_per_unit to reflect the new vendor cost
                    await supabase
                        .from('products')
                        .update({ cost_per_unit: item.unitCost })
                        .eq('id', item.id)
                        .eq('tenant_id', tenant.id);
                }
            }

            toast.success("Purchase Order created successfully");
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
            navigateToAdmin('wholesale-orders'); // Back to main list

        } catch (error: any) {
            logger.error('Failed to create PO', error);
            toast.error(humanizeError(error, 'Failed to create purchase order'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        const q = productSearch.toLowerCase();
        return allProducts.filter(p => p.name.toLowerCase().includes(q));
    }, [allProducts, productSearch]);

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('wholesale-orders')} aria-label="Back to wholesale orders">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">New Purchase Order</h1>
                    <p className="text-muted-foreground">Create a restocking order for a vendor</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {/* Steps Indicator */}
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span className={step >= 1 ? 'text-primary' : 'text-muted-foreground'}>1. Vendor</span>
                        <div className="w-4 h-px bg-border" />
                        <span className={step >= 2 ? 'text-primary' : 'text-muted-foreground'}>2. Items & Details</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">

                    {step === 1 && (
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Select Vendor</h2>
                            <SmartVendorPicker
                                selectedVendor={poData.vendor}
                                onSelect={(vendor) => setPoData(prev => ({ ...prev, vendor }))}
                                onClear={() => setPoData(prev => ({ ...prev, vendor: null }))}
                            />
                            <div className="mt-6 flex justify-end">
                                <DisabledTooltip disabled={!poData.vendor} reason="Select a vendor to continue">
                                    <Button
                                        onClick={handleNext}
                                        disabled={!poData.vendor}
                                    >
                                        Next Step <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </DisabledTooltip>
                            </div>
                        </Card>
                    )}

                    {step === 2 && (
                        <Card className="p-4 space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold mb-4">Order Items</h2>

                                {/* Product Search */}
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        aria-label="Search products to add"
                                        placeholder="Search products to add..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                    {/* Search Results Dropdown */}
                                    {filteredProducts.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                                            {filteredProducts.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"
                                                    onClick={() => handleAddItem(p)}
                                                >
                                                    <span>{p.name}</span>
                                                    <span className="text-muted-foreground text-sm">{formatCurrency(p.cost_per_unit || 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Items List */}
                                <div className="space-y-3">
                                    {poData.items.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                                            No items added yet. Search products above.
                                        </div>
                                    ) : (
                                        poData.items.map((item) => (
                                            <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 border rounded-lg bg-card">
                                                <div className="flex-1 font-medium">
                                                    {item.name}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Label className="sr-only">Qty</Label>
                                                    <Input
                                                        type="number"
                                                        value={item.qty}
                                                        onChange={e => handleUpdateItem(item.id, { qty: parseInt(e.target.value) || 0 })}
                                                        className="w-20"
                                                        min={1}
                                                    />
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                                        <Input
                                                            type="number"
                                                            value={item.unitCost}
                                                            onChange={e => handleUpdateItem(item.id, { unitCost: parseFloat(e.target.value) || 0 })}
                                                            className="w-24 pl-5"
                                                            step="0.01"
                                                        />
                                                    </div>
                                                    <div className="w-24 text-right font-semibold">
                                                        {formatCurrency(item.qty * item.unitCost)}
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} aria-label="Remove item">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="border-t pt-6 space-y-4">
                                <h3 className="font-semibold">Order Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Expected Delivery Date</Label>
                                        <Input
                                            type="date"
                                            value={poData.expectedDeliveryDate}
                                            onChange={e => setPoData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Internal Notes</Label>
                                        <Textarea
                                            placeholder="Optional notes for this order..."
                                            value={poData.notes}
                                            onChange={e => setPoData(prev => ({ ...prev, notes: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={handleBack}>Back</Button>
                                {/* Submit handled in Summary Panel on right for better UX */}
                            </div>
                        </Card>
                    )}

                </div>

                {/* Sidebar Summary */}
                <div className="space-y-4">
                    <Card className="p-4 sticky top-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" /> Order Summary
                        </h3>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Vendor:</span>
                                <span className="font-medium text-right">{poData.vendor?.name || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Items:</span>
                                <span>{poData.items.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Units:</span>
                                <span>{poData.items.reduce((s, i) => s + i.qty, 0)}</span>
                            </div>
                            <div className="border-t my-2 pt-2 flex justify-between font-bold text-lg">
                                <span>Total:</span>
                                <span>{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>

                        {step === 2 && (
                            <DisabledTooltip
                                disabled={!isSubmitting && poData.items.length === 0}
                                reason="Add at least one item to create a purchase order"
                            >
                                <Button
                                    className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700"
                                    size="lg"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || poData.items.length === 0}
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
                                </Button>
                            </DisabledTooltip>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
