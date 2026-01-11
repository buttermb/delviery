/**
 * Checkout Loyalty Redemption Component
 * Allows customers to view and redeem loyalty points at checkout
 * Based on Flowhub's loyalty integration
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useLuxuryTheme } from '@/components/shop/luxury';
import {
    Gift,
    Star,
    Loader2,
    ChevronDown,
    ChevronUp,
    Check
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface CheckoutLoyaltyProps {
    storeId: string;
    customerEmail: string;
    orderSubtotal: number;
    onPointsRedeemed: (discount: number, pointsUsed: number) => void;
    onPointsRemoved: () => void;
    redeemedPoints?: number;
    redeemedDiscount?: number;
}

interface LoyaltyInfo {
    customer_id: string;
    loyalty_points: number;
    lifetime_points: number;
    points_to_dollar_ratio: number;
}

interface LoyaltyReward {
    id: string;
    name: string;
    description: string;
    points_required: number;
    reward_type: string;
    reward_value: number;
    is_active: boolean;
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
    const { toast } = useToast();
    const [isExpanded, setIsExpanded] = useState(false);
    const [customPoints, setCustomPoints] = useState('');
    const {
        isLuxuryTheme,
        accentColor,
        cardBg,
        cardBorder,
        textPrimary,
        textMuted
    } = useLuxuryTheme();

    // Fetch customer loyalty info
    const { data: loyaltyInfo, isLoading } = useQuery({
        queryKey: ['checkout-loyalty', storeId, customerEmail],
        queryFn: async () => {
            if (!customerEmail) return null;

            const { data, error } = await supabase
                .rpc('get_marketplace_customer_loyalty', {
                    p_store_id: storeId,
                    p_email: customerEmail,
                });

            if (error) {
                // RPC may not exist yet
                console.warn('Loyalty lookup failed:', error);
                return null;
            }

            return (data?.[0] as LoyaltyInfo) || null;
        },
        enabled: !!storeId && !!customerEmail,
    });

    // Fetch available rewards
    const { data: rewards = [] } = useQuery({
        queryKey: ['checkout-loyalty-rewards', storeId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_loyalty_rewards')
                .select('*')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .order('points_required', { ascending: true });

            if (error) {
                console.warn('Rewards lookup failed:', error);
                return [];
            }

            return data as LoyaltyReward[];
        },
        enabled: !!storeId,
    });

    // Calculate points value
    const pointsToRedeem = parseInt(customPoints) || 0;
    const pointsRatio = loyaltyInfo?.points_to_dollar_ratio || 100;
    const availablePoints = loyaltyInfo?.loyalty_points || 0;
    const maxRedeemableDiscount = Math.min(
        availablePoints / pointsRatio,
        orderSubtotal * 0.5 // Max 50% discount via points
    );
    const maxRedeemablePoints = Math.floor(maxRedeemableDiscount * pointsRatio);

    // Handle redemption
    const handleRedeem = (points: number) => {
        if (points > availablePoints) {
            toast({
                title: 'Not enough points',
                description: `You have ${availablePoints} points available.`,
                variant: 'destructive',
            });
            return;
        }

        const discount = points / pointsRatio;
        onPointsRedeemed(discount, points);
        toast({
            title: 'Points applied!',
            description: `${points} points = ${formatCurrency(discount)} discount`,
        });
        setCustomPoints('');
    };

    // Quick redemption amounts
    const quickAmounts = [
        { points: 100, label: formatCurrency(100 / pointsRatio) },
        { points: 500, label: formatCurrency(500 / pointsRatio) },
        { points: 1000, label: formatCurrency(1000 / pointsRatio) },
    ].filter(a => a.points <= availablePoints);

    // Don't render if no email or loading
    if (!customerEmail) return null;

    // Show compact "earn points" message if customer has no account/points
    if (!isLoading && !loyaltyInfo) {
        return (
            <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : 'border-dashed'}>
                <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                        <Star className="w-5 h-5 text-amber-500" />
                        <div>
                            <p className={`text-sm font-medium ${isLuxuryTheme ? textPrimary : ''}`}>
                                Earn rewards on this order!
                            </p>
                            <p className={`text-xs ${textMuted}`}>
                                You'll earn points for every dollar spent
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
                <CardContent className="py-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className={textMuted}>Checking your rewards...</span>
                </CardContent>
            </Card>
        );
    }

    // Already redeemed
    if (redeemedPoints > 0) {
        return (
            <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder} border-green-500/30` : 'border-green-200 bg-green-50'}>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLuxuryTheme ? 'bg-green-500/20' : 'bg-green-100'}`}>
                                <Check className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <p className={`font-medium ${isLuxuryTheme ? 'text-green-400' : 'text-green-700'}`}>
                                    {redeemedPoints} points applied
                                </p>
                                <p className={`text-sm ${isLuxuryTheme ? 'text-green-400/70' : 'text-green-600'}`}>
                                    -{formatCurrency(redeemedDiscount)} discount
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onPointsRemoved}
                            className={isLuxuryTheme ? 'text-red-400 hover:text-red-300 hover:bg-white/5' : 'text-red-500'}
                        >
                            Remove
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Main loyalty UI with points
    return (
        <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
            <CardContent className="py-4">
                {/* Header - Always Visible */}
                <button
                    className="w-full flex items-center justify-between"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${accentColor || '#10b981'}15` }}
                        >
                            <Gift className="w-5 h-5" style={{ color: accentColor || '#10b981' }} />
                        </div>
                        <div className="text-left">
                            <p className={`font-medium ${isLuxuryTheme ? textPrimary : ''}`}>
                                {availablePoints.toLocaleString()} points available
                            </p>
                            <p className={`text-sm ${textMuted}`}>
                                Worth up to {formatCurrency(maxRedeemableDiscount)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={isLuxuryTheme ? 'bg-white/10 text-white/80' : ''}>
                            {pointsRatio} pts = $1
                        </Badge>
                        {isExpanded ? (
                            <ChevronUp className={`w-5 h-5 ${textMuted}`} />
                        ) : (
                            <ChevronDown className={`w-5 h-5 ${textMuted}`} />
                        )}
                    </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Quick Redemption Buttons */}
                        {quickAmounts.length > 0 && (
                            <div>
                                <p className={`text-sm mb-2 ${textMuted}`}>Quick redeem:</p>
                                <div className="flex gap-2 flex-wrap">
                                    {quickAmounts.map(({ points, label }) => (
                                        <Button
                                            key={points}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRedeem(points)}
                                            className={isLuxuryTheme ? 'border-white/20 hover:bg-white/10' : ''}
                                        >
                                            {points} pts → {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Custom Amount */}
                        <div>
                            <p className={`text-sm mb-2 ${textMuted}`}>Or enter custom amount:</p>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder={`Max ${maxRedeemablePoints}`}
                                    value={customPoints}
                                    onChange={(e) => setCustomPoints(e.target.value)}
                                    max={maxRedeemablePoints}
                                    className={isLuxuryTheme ? 'bg-white/5 border-white/20' : ''}
                                />
                                <Button
                                    onClick={() => handleRedeem(pointsToRedeem)}
                                    disabled={!pointsToRedeem || pointsToRedeem > maxRedeemablePoints}
                                    style={{ backgroundColor: accentColor || '#10b981' }}
                                >
                                    Apply
                                </Button>
                            </div>
                            {pointsToRedeem > 0 && (
                                <p className={`text-sm mt-1 ${textMuted}`}>
                                    = {formatCurrency(pointsToRedeem / pointsRatio)} discount
                                </p>
                            )}
                        </div>

                        {/* Available Rewards */}
                        {rewards.length > 0 && (
                            <>
                                <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />
                                <div>
                                    <p className={`text-sm font-medium mb-2 ${isLuxuryTheme ? textPrimary : ''}`}>
                                        Available Rewards
                                    </p>
                                    <div className="space-y-2">
                                        {rewards.slice(0, 3).map((reward) => (
                                            <div
                                                key={reward.id}
                                                className={`flex items-center justify-between p-2 rounded-lg ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted/50'
                                                    }`}
                                            >
                                                <div>
                                                    <p className={`text-sm font-medium ${isLuxuryTheme ? textPrimary : ''}`}>
                                                        {reward.name}
                                                    </p>
                                                    <p className={`text-xs ${textMuted}`}>
                                                        {reward.points_required} points
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={availablePoints < reward.points_required}
                                                    onClick={() => handleRedeem(reward.points_required)}
                                                    className={isLuxuryTheme ? 'border-white/20' : ''}
                                                >
                                                    Redeem
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default CheckoutLoyalty;
