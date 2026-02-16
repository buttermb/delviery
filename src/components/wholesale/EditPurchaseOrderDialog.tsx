import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TruncatedText } from '@/components/shared/TruncatedText';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus, Minus, Trash2, Package, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface PurchaseOrderItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    vendor_id: string;
    total: number;
    status: string;
    expected_delivery_date?: string;
    notes?: string;
    created_at: string;
    vendor?: {
        name: string;
        contact_name?: string;
    };
    items?: PurchaseOrderItem[];
}

interface EditPurchaseOrderDialogProps {
    order: PurchaseOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditPurchaseOrderDialog({
    order,
    open,
    onOpenChange,
    onSuccess,
}: EditPurchaseOrderDialogProps) {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('');

    // Reset form when order changes
    useEffect(() => {
        if (order) {
            setItems(order.items || []);
            setExpectedDate(order.expected_delivery_date ? order.expected_delivery_date.split('T')[0] : '');
            setNotes(order.notes || '');
            setStatus(order.status);
        }
    }, [order]);

    // Calculate totals
    const total = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    // Item handlers
    const handleUpdateItem = (itemId: string, field: 'quantity' | 'unit_cost', value: number) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item
            )
        );
    };

    const handleRemoveItem = (itemId: string) => {
        if (items.length <= 1) {
            toast.error('Order must have at least one item');
            return;
        }
        setItems((prev) => prev.filter((item) => item.id !== itemId));
    };

    // Submit handler
    const handleSubmit = async () => {
        if (!order) return;

        if (items.length === 0) {
            toast.error('Order must have at least one item');
            return;
        }

        setIsSubmitting(true);

        try {
            // Update order details
            const { error: orderError } = await supabase
                .from('purchase_orders' as any)
                .update({
                    expected_delivery_date: expectedDate || null,
                    notes: notes,
                    status,
                    total: total,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // Update order items
            // First, delete existing items (simple approach, can be optimized to upsert)
            const { error: deleteError } = await supabase
                .from('purchase_order_items' as any)
                .delete()
                .eq('po_id', order.id);

            if (deleteError) throw deleteError;

            // Insert updated items
            const { error: insertError } = await supabase
                .from('purchase_order_items' as any)
                .insert(
                    items.map((item) => ({
                        po_id: order.id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_cost: item.unit_cost,
                    })) as any
                );

            if (insertError) throw insertError;

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] }); // Covers both

            toast.success('Purchase Order updated successfully');
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            logger.error('Failed to update purchase order', error, { component: 'EditPurchaseOrderDialog' });
            toast.error('Failed to update order');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Edit PO #{order.po_number}
                    </DialogTitle>
                    <DialogDescription>
                        Modify purchase order details, items, and delivery date
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Vendor Info (Read-only) */}
                    <div>
                        <Label className="text-muted-foreground">Vendor</Label>
                        <div className="mt-1 p-3 bg-muted rounded-lg">
                            <p className="font-medium">{order.vendor?.name || 'Unknown Vendor'}</p>
                            <p className="text-sm text-muted-foreground">{order.vendor?.contact_name}</p>
                        </div>
                    </div>

                    {/* Status and Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="ordered">Ordered</SelectItem>
                                    <SelectItem value="received">Received</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Expected Delivery Date</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Order Items */}
                    <div className="space-y-3">
                        <Label>Order Items</Label>
                        {items.map((item) => (
                            <Card key={item.id} className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <TruncatedText text={item.product_name} className="font-medium" as="p" />
                                        <div className="flex items-center gap-3 mt-2">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() =>
                                                        handleUpdateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))
                                                    }
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        handleUpdateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))
                                                    }
                                                    className="h-7 w-16 text-center"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() =>
                                                        handleUpdateItem(item.id, 'quantity', item.quantity + 1)
                                                    }
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                                <span className="text-xs text-muted-foreground">units</span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">@</div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-muted-foreground">$</span>
                                                <Input
                                                    type="number"
                                                    value={item.unit_cost}
                                                    onChange={(e) =>
                                                        handleUpdateItem(item.id, 'unit_cost', Math.max(0, Number(e.target.value)))
                                                    }
                                                    className="h-7 w-20"
                                                    step="0.01"
                                                />
                                                <span className="text-xs text-muted-foreground">/unit</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-mono font-semibold">
                                            {formatCurrency(item.quantity * item.unit_cost)}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-destructive hover:text-destructive mt-1"
                                            onClick={() => handleRemoveItem(item.id)}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {/* Totals */}
                        <div className="flex justify-between items-center pt-2 border-t">
                            <div className="text-sm text-muted-foreground">
                                Total Items: {totalItems}
                            </div>
                            <div className="text-lg font-semibold font-mono">
                                {formatCurrency(total)}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Notes */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Internal Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Internal notes about this PO..."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
