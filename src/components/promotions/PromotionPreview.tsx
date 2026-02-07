/**
 * PromotionPreview Component
 * Shows real-time preview of promotion discount calculation
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { ShoppingCart, Tag, TrendingDown } from 'lucide-react';

interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
}

interface PromotionPreviewProps {
    promotionType: string;
    discountValue: number;
    buyQuantity?: number;
    getQuantity?: number;
    getDiscountPercent?: number;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    sampleCart?: CartItem[];
}

export function PromotionPreview({
    promotionType,
    discountValue,
    buyQuantity,
    getQuantity,
    getDiscountPercent,
    minPurchaseAmount,
    maxDiscountAmount,
    sampleCart = DEFAULT_SAMPLE_CART,
}: PromotionPreviewProps) {
    const subtotal = sampleCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    let discount = 0;
    let explanation = '';

    switch (promotionType) {
        case 'fixed_discount':
            discount = discountValue;
            explanation = `${formatCurrency(discountValue)} off your order`;
            break;

        case 'percentage_discount':
            discount = subtotal * (discountValue / 100);
            if (maxDiscountAmount && discount > maxDiscountAmount) {
                discount = maxDiscountAmount;
                explanation = `${discountValue}% off (capped at ${formatCurrency(maxDiscountAmount)})`;
            } else {
                explanation = `${discountValue}% off your order`;
            }
            break;

        case 'buy_x_get_y':
            if (buyQuantity && getQuantity && getDiscountPercent) {
                const totalQty = sampleCart.reduce((sum, item) => sum + item.quantity, 0);
                const sets = Math.floor(totalQty / (buyQuantity + getQuantity));
                const avgPrice = subtotal / totalQty;
                discount = sets * getQuantity * avgPrice * (getDiscountPercent / 100);
                explanation = `Buy ${buyQuantity}, get ${getQuantity} at ${getDiscountPercent}% off`;
            }
            break;

        case 'spending_threshold':
            if (minPurchaseAmount) {
                if (subtotal >= minPurchaseAmount) {
                    discount = discountValue;
                    explanation = `Spend ${formatCurrency(minPurchaseAmount)}, get ${formatCurrency(discountValue)} off`;
                } else {
                    explanation = `Spend ${formatCurrency(minPurchaseAmount - subtotal)} more to qualify`;
                }
            }
            break;

        case 'free_shipping':
            if (!minPurchaseAmount || subtotal >= minPurchaseAmount) {
                explanation = 'Free shipping on this order';
            } else {
                explanation = `Spend ${formatCurrency(minPurchaseAmount - subtotal)} more for free shipping`;
            }
            break;
    }

    const total = Math.max(0, subtotal - discount);
    const isQualified = discount > 0 || promotionType === 'free_shipping';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Promotion Preview
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Sample Cart */}
                <div>
                    <p className="text-sm font-medium mb-2">Sample Cart</p>
                    <div className="space-y-1">
                        {sampleCart.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm text-muted-foreground">
                                <span>
                                    {item.name} x{item.quantity}
                                </span>
                                <span>{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Calculation */}
                <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>

                    {isQualified && discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span className="flex items-center gap-1">
                                <TrendingDown className="w-3 h-3" />
                                Promotion Discount
                            </span>
                            <span>-{formatCurrency(discount)}</span>
                        </div>
                    )}

                    <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>

                {/* Explanation */}
                <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                        <Tag className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{explanation}</p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">
                    {isQualified ? (
                        <Badge className="bg-green-500">
                            ✓ Promotion Applied
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            Conditions Not Met
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Default sample cart for preview
const DEFAULT_SAMPLE_CART: CartItem[] = [
    { productId: '1', name: 'Product A', price: 25.00, quantity: 2 },
    { productId: '2', name: 'Product B', price: 15.00, quantity: 1 },
    { productId: '3', name: 'Product C', price: 30.00, quantity: 1 },
];
