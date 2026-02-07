import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface PurchaseOrder {
    id: string;
    po_number: string;
    total: number;
    status: string;
    vendor_id?: string;
    vendor?: {
        name: string;
    };
}

interface CancelPurchaseOrderDialogProps {
    order: PurchaseOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CancelPurchaseOrderDialog({
    order,
    open,
    onOpenChange,
    onSuccess,
}: CancelPurchaseOrderDialogProps) {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');

    const handleCancel = async () => {
        if (!order) return;

        setIsSubmitting(true);

        try {
            // Update order status to cancelled
            const { error: orderError } = await supabase
                .from('purchase_orders')
                .update({
                    status: 'cancelled',
                    notes: `[CANCELLED] ${cancellationReason || 'No reason provided'}`,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });

            toast.success('Purchase Order cancelled successfully');
            onOpenChange(false);
            setCancellationReason('');
            onSuccess?.();
        } catch (error) {
            logger.error('Failed to cancel PO', error, { component: 'CancelPurchaseOrderDialog' });
            toast.error('Failed to cancel purchase order');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!order) return null;

    const isAlreadyCancelled = order.status === 'cancelled';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Cancel PO #{order.po_number}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                        {isAlreadyCancelled ? (
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="font-medium">This purchase order is already cancelled.</p>
                            </div>
                        ) : (
                            <>
                                <p>
                                    This action will cancel the purchase order. It cannot be undone.
                                </p>

                                {/* Order Summary */}
                                <div className="p-3 bg-muted rounded-lg space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Vendor:</span>
                                        <span className="font-medium">{order.vendor?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total:</span>
                                        <span className="font-mono font-semibold">{formatCurrency(order.total)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Current Status:</span>
                                        <Badge variant="outline">{order.status}</Badge>
                                    </div>
                                </div>

                                {/* Cancellation Reason */}
                                <div className="space-y-2">
                                    <Label htmlFor="reason">Cancellation Reason (Optional)</Label>
                                    <Textarea
                                        id="reason"
                                        value={cancellationReason}
                                        onChange={(e) => setCancellationReason(e.target.value)}
                                        placeholder="Why is this PO being cancelled?"
                                        rows={3}
                                    />
                                </div>
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>
                        {isAlreadyCancelled ? 'Close' : 'Keep PO'}
                    </AlertDialogCancel>
                    {!isAlreadyCancelled && (
                        <AlertDialogAction
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Cancelling...
                                </>
                            ) : (
                                'Yes, Cancel PO'
                            )}
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
