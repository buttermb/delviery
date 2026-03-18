/**
 * PromotionBuilder Component
 * Advanced promotion creation with flexible rules
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Tag, Gift, TrendingUp, Truck } from 'lucide-react';

export type PromotionType =
    | 'fixed_discount'
    | 'percentage_discount'
    | 'buy_x_get_y'
    | 'spending_threshold'
    | 'free_shipping';

export type TargetType = 'all' | 'specific_products' | 'specific_categories' | 'customer_groups';

export interface PromotionData {
    name: string;
    code: string;
    promotion_type: PromotionType;
    discount_value: number;
    target_type: TargetType;
    target_ids: string[];

    // Buy X Get Y fields
    buy_quantity?: number;
    get_quantity?: number;
    get_discount_percent?: number;

    // Spending threshold fields
    min_purchase_amount?: number;
    max_discount_amount?: number;

    // Conditions
    conditions: {
        min_items?: number;
        max_uses_per_customer?: number;
        customer_groups?: string[];
        excluded_products?: string[];
        first_time_customers_only?: boolean;
    };

    // Validity
    valid_from?: string;
    valid_until?: string;
    max_uses?: number;
}

interface PromotionBuilderProps {
    initialData?: Partial<PromotionData>;
    onChange?: (data: PromotionData) => void;
    onSave?: (data: PromotionData) => Promise<void>;
}

const PROMOTION_TYPES = [
    {
        value: 'fixed_discount' as const,
        label: 'Fixed Amount Off',
        icon: Tag,
        description: '$X off entire order',
    },
    {
        value: 'percentage_discount' as const,
        label: 'Percentage Off',
        icon: TrendingUp,
        description: 'X% off entire order',
    },
    {
        value: 'buy_x_get_y' as const,
        label: 'Buy X Get Y',
        icon: Gift,
        description: 'Buy X items, get Y at discount',
    },
    {
        value: 'spending_threshold' as const,
        label: 'Spending Threshold',
        icon: TrendingUp,
        description: 'Spend $X, get discount',
    },
    {
        value: 'free_shipping' as const,
        label: 'Free Shipping',
        icon: Truck,
        description: 'Free shipping on orders',
    },
];

export function PromotionBuilder({ initialData, onChange, onSave }: PromotionBuilderProps) {
    const [formData, setFormData] = useState<Partial<PromotionData>>({
        promotion_type: 'fixed_discount',
        target_type: 'all',
        discount_value: 0,
        target_ids: [],
        conditions: {},
        ...initialData,
    });

    const updateField = <K extends keyof PromotionData>(field: K, value: PromotionData[K]) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);
        onChange?.(updated as PromotionData);
    };

    const updateCondition = (key: string, value: unknown) => {
        const updated = {
            ...formData,
            conditions: { ...formData.conditions, [key]: value },
        };
        setFormData(updated);
        onChange?.(updated as PromotionData);
    };

    const selectedType = PROMOTION_TYPES.find((t) => t.value === formData.promotion_type);

    return (
        <div className="space-y-6">
            {/* Promotion Type Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Promotion Type</CardTitle>
                    <CardDescription>Choose the type of promotion to create</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {PROMOTION_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = formData.promotion_type === type.value;

                            return (
                                <button
                                    key={type.value}
                                    onClick={() => updateField('promotion_type', type.value)}
                                    className={cn(
                                        'p-4 border-2 rounded-lg text-left transition-all hover:border-primary',
                                        isSelected && 'border-primary bg-primary/5'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Icon className={cn('w-5 h-5 mt-0.5', isSelected && 'text-primary')} />
                                        <div className="flex-1">
                                            <div className="font-medium">{type.label}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {type.description}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <Badge variant="default" className="ml-auto">Selected</Badge>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Basic Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="promo-name">Promotion Name *</Label>
                            <Input
                                id="promo-name"
                                placeholder="Summer Sale 2024"
                                value={formData.name ?? ''}
                                onChange={(e) => updateField('name', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="promo-code">Coupon Code *</Label>
                            <Input
                                id="promo-code"
                                placeholder="SUMMER20"
                                value={formData.code ?? ''}
                                onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Discount Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Discount Configuration</CardTitle>
                    <CardDescription>{selectedType?.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Fixed Discount */}
                    {formData.promotion_type === 'fixed_discount' && (
                        <div className="space-y-2">
                            <Label htmlFor="discount-value">Discount Amount ($) *</Label>
                            <Input
                                id="discount-value"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="10.00"
                                value={formData.discount_value || ''}
                                onChange={(e) => updateField('discount_value', parseFloat(e.target.value))}
                            />
                        </div>
                    )}

                    {/* Percentage Discount */}
                    {formData.promotion_type === 'percentage_discount' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="discount-percent">Discount Percentage (%) *</Label>
                                <Input
                                    id="discount-percent"
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="20"
                                    value={formData.discount_value || ''}
                                    onChange={(e) => updateField('discount_value', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max-discount">Max Discount Amount ($)</Label>
                                <Input
                                    id="max-discount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="50.00"
                                    value={formData.max_discount_amount || ''}
                                    onChange={(e) => updateField('max_discount_amount', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    {/* Buy X Get Y */}
                    {formData.promotion_type === 'buy_x_get_y' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="buy-qty">Buy Quantity *</Label>
                                    <Input
                                        id="buy-qty"
                                        type="number"
                                        min="1"
                                        placeholder="2"
                                        value={formData.buy_quantity || ''}
                                        onChange={(e) => updateField('buy_quantity', parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="get-qty">Get Quantity *</Label>
                                    <Input
                                        id="get-qty"
                                        type="number"
                                        min="1"
                                        placeholder="1"
                                        value={formData.get_quantity || ''}
                                        onChange={(e) => updateField('get_quantity', parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="get-discount">Get Discount (%) *</Label>
                                    <Input
                                        id="get-discount"
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="50"
                                        value={formData.get_discount_percent || ''}
                                        onChange={(e) => updateField('get_discount_percent', parseInt(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-sm">
                                <strong>Preview:</strong> Buy {formData.buy_quantity || 'X'} items, get{' '}
                                {formData.get_quantity || 'Y'} at {formData.get_discount_percent || '0'}% off
                            </div>
                        </div>
                    )}

                    {/* Spending Threshold */}
                    {formData.promotion_type === 'spending_threshold' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="min-purchase">Minimum Purchase ($) *</Label>
                                <Input
                                    id="min-purchase"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="100.00"
                                    value={formData.min_purchase_amount || ''}
                                    onChange={(e) => updateField('min_purchase_amount', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="threshold-discount">Discount Amount ($) *</Label>
                                <Input
                                    id="threshold-discount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="20.00"
                                    value={formData.discount_value || ''}
                                    onChange={(e) => updateField('discount_value', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    {/* Free Shipping */}
                    {formData.promotion_type === 'free_shipping' && (
                        <div className="space-y-2">
                            <Label htmlFor="shipping-min">Minimum Purchase for Free Shipping ($)</Label>
                            <Input
                                id="shipping-min"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="50.00"
                                value={formData.min_purchase_amount || ''}
                                onChange={(e) => updateField('min_purchase_amount', parseFloat(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty for no minimum purchase requirement
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Additional Conditions */}
            <Card>
                <CardHeader>
                    <CardTitle>Additional Conditions</CardTitle>
                    <CardDescription>Optional rules to refine your promotion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max-uses">Maximum Total Uses</Label>
                            <Input
                                id="max-uses"
                                type="number"
                                min="1"
                                placeholder="Unlimited"
                                value={formData.max_uses || ''}
                                onChange={(e) => updateField('max_uses', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max-customer-uses">Max Uses Per Customer</Label>
                            <Input
                                id="max-customer-uses"
                                type="number"
                                min="1"
                                placeholder="Unlimited"
                                value={formData.conditions?.max_uses_per_customer || ''}
                                onChange={(e) => updateCondition('max_uses_per_customer', parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>First-Time Customers Only</Label>
                            <p className="text-xs text-muted-foreground">
                                Only allow new customers to use this promotion
                            </p>
                        </div>
                        <Switch
                            checked={formData.conditions?.first_time_customers_only ?? false}
                            onCheckedChange={(checked) => updateCondition('first_time_customers_only', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Validity Period */}
            <Card>
                <CardHeader>
                    <CardTitle>Validity Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="valid-from">Start Date</Label>
                            <Input
                                id="valid-from"
                                type="datetime-local"
                                value={formData.valid_from ?? ''}
                                onChange={(e) => updateField('valid_from', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="valid-until">End Date</Label>
                            <Input
                                id="valid-until"
                                type="datetime-local"
                                value={formData.valid_until ?? ''}
                                onChange={(e) => updateField('valid_until', e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            {onSave && (
                <div className="flex justify-end">
                    <Button
                        size="lg"
                        onClick={() => onSave(formData as PromotionData)}
                        disabled={!formData.name || !formData.code}
                    >
                        Save Promotion
                    </Button>
                </div>
            )}
        </div>
    );
}
