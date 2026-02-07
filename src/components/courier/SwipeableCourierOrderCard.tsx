/**
 * SwipeableCourierOrderCard
 * Wraps CourierOrderCard with swipe actions for quick mobile interactions
 * - Swipe right: Accept order
 * - Swipe left: Decline/Skip order
 */

import { memo } from 'react';
import { Check, X } from 'lucide-react';
import { CourierOrderCard } from './CourierOrderCard';
import SwipeableRow from '@/components/mobile/SwipeableRow';
import { triggerHaptic } from '@/lib/utils/mobile';

interface Order {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    delivery_address: string;
    delivery_borough: string;
    tip_amount?: number;
    customer_name?: string;
    addresses?: {
        street: string;
        apartment?: string;
    };
    order_items?: Array<{
        product_name: string;
        quantity: number;
    }>;
}

interface SwipeableCourierOrderCardProps {
    order: Order;
    onAccept?: (orderId: string) => void;
    onDecline?: (orderId: string) => void;
    onAction?: (orderId: string, action: string) => void;
    isActive?: boolean;
    showEarnings?: boolean;
    commissionRate?: number;
    /** Enable swipe actions (default: true on mobile) */
    enableSwipe?: boolean;
}

export const SwipeableCourierOrderCard = memo(({
    order,
    onAccept,
    onDecline,
    onAction,
    isActive = false,
    showEarnings = true,
    commissionRate = 30,
    enableSwipe = true,
}: SwipeableCourierOrderCardProps) => {
    const handleAccept = () => {
        triggerHaptic('medium');
        onAccept?.(order.id);
    };

    const handleDecline = () => {
        triggerHaptic('light');
        onDecline?.(order.id);
        onAction?.(order.id, 'decline');
    };

    // If swipe is disabled, render regular card
    if (!enableSwipe) {
        return (
            <CourierOrderCard
                order={order}
                onAccept={onAccept}
                onAction={onAction}
                isActive={isActive}
                showEarnings={showEarnings}
                commissionRate={commissionRate}
            />
        );
    }

    return (
        <SwipeableRow
            rightAction={onAccept ? {
                label: 'Accept',
                color: '#10b981', // emerald-500
                icon: <Check className="h-6 w-6" />,
                onAction: handleAccept,
            } : undefined}
            leftAction={onDecline ? {
                label: 'Decline',
                color: '#ef4444', // red-500
                icon: <X className="h-6 w-6" />,
                onAction: handleDecline,
            } : undefined}
        >
            <CourierOrderCard
                order={order}
                onAccept={undefined} // Hide button when swipe is enabled
                onAction={onAction}
                isActive={isActive}
                showEarnings={showEarnings}
                commissionRate={commissionRate}
            />
        </SwipeableRow>
    );
});

SwipeableCourierOrderCard.displayName = 'SwipeableCourierOrderCard';

export default SwipeableCourierOrderCard;
