/**
 * Checkout Loyalty Redemption Component
 * Placeholder - loyalty features require additional database setup
 */

import { Card, CardContent } from '@/components/ui/card';
import { Gift } from 'lucide-react';

interface CheckoutLoyaltyProps {
    storeId: string;
    customerEmail: string;
    orderSubtotal: number;
    onPointsRedeemed: (discount: number, pointsUsed: number) => void;
    onPointsRemoved: () => void;
    redeemedPoints?: number;
    redeemedDiscount?: number;
}

export function CheckoutLoyalty({
    storeId,
    customerEmail,
    orderSubtotal,
    onPointsRedeemed,
    onPointsRemoved,
    redeemedPoints = 0,
    redeemedDiscount = 0,
}: CheckoutLoyaltyProps) {
    // Loyalty features require additional database tables
    // Return null for now - will be enabled when loyalty tables are created
    return null;
}
