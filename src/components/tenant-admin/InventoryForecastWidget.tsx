/**
 * Inventory Forecast Widget
 * Predicts when items will run out of stock based on REAL sales velocity
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CalendarClock,
    ArrowRight,
    AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { InventoryStatusBadge } from '@/components/admin/InventoryStatusBadge';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface ForecastItem {
    id: string;
    product_name: string;
    quantity_lbs: number;
    daily_velocity: number;
    days_remaining: number;
    reorder_point: number;
    has_sales_data: boolean;
}

interface ProductWithStock {
    id: string;
    name: string;
    stock_quantity: number | null;
    available_quantity: number | null;
    low_stock_alert: number | null;
}

interface SalesDataItem {
    product_name: string;
    quantity: number;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export function InventoryForecastWidget() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data: atRiskItems, isLoading } = useQuery({
        queryKey: queryKeys.tenantWidgets.inventoryForecast(tenantId),
        queryFn: async () => {
            if (!tenantId) return [];

            // 1. Get ALL products to find low stock items
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('id, name, stock_quantity, available_quantity, low_stock_alert')
                .eq('tenant_id', tenantId);

            if (productsError) {
                logger.error('Failed to fetch products for forecast', productsError, { component: 'InventoryForecastWidget' });
                return [];
            }

            if (!products || products.length === 0) return [];

            // 2. Get REAL sales history from wholesale_order_items (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Query wholesale_order_items joined with wholesale_orders to filter by tenant and date
            const { data: salesData, error: salesError } = await supabase
                .from('wholesale_order_items')
                .select(`
                    product_name,
                    quantity,
                    wholesale_orders!inner(
                        tenant_id,
                        created_at
                    )
                `)
                .eq('wholesale_orders.tenant_id', tenantId)
                .gte('wholesale_orders.created_at', thirtyDaysAgo.toISOString());

            if (salesError) {
                logger.warn('Failed to fetch sales data for velocity calculation', salesError, { component: 'InventoryForecastWidget' });
                // Continue without sales data - will show items with no velocity
            }

            // 3. Calculate daily velocity per product from REAL sales data
            const velocityMap = new Map<string, number>();
            const salesItems = (salesData ?? []) as SalesDataItem[];

            salesItems.forEach(item => {
                const productName = item.product_name?.toLowerCase().trim();
                if (productName) {
                    const current = velocityMap.get(productName) ?? 0;
                    velocityMap.set(productName, current + (item.quantity ?? 0));
                }
            });

            // Convert total sales to daily average (divide by 30 days)
            velocityMap.forEach((totalSold, productName) => {
                velocityMap.set(productName, totalSold / 30);
            });

            // 4. Build forecast for each product
            const forecasts: ForecastItem[] = (products as ProductWithStock[]).map(item => {
                const currentStock = item.available_quantity ?? item.stock_quantity ?? 0;
                const reorderPoint = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;

                // Look up velocity by product name (case-insensitive)
                const productNameKey = item.name?.toLowerCase().trim() ?? '';
                const dailyVelocity = velocityMap.get(productNameKey) ?? 0;
                const hasSalesData = dailyVelocity > 0;

                // Calculate days remaining
                let daysRemaining: number;
                if (currentStock <= 0) {
                    daysRemaining = 0; // Already out of stock
                } else if (dailyVelocity <= 0) {
                    daysRemaining = 999; // No sales = won't run out (or no data)
                } else {
                    daysRemaining = Math.floor(currentStock / dailyVelocity);
                }

                return {
                    id: item.id,
                    product_name: item.name,
                    quantity_lbs: currentStock,
                    daily_velocity: dailyVelocity,
                    days_remaining: daysRemaining,
                    reorder_point: reorderPoint,
                    has_sales_data: hasSalesData
                };
            });

            // 5. Filter for items that are:
            //    - Already at or below reorder point (low stock)
            //    - OR will run out within 14 days based on velocity
            //    - Prioritize items with actual sales data
            const atRisk = forecasts.filter(item => {
                const isLowStock = item.quantity_lbs <= item.reorder_point;
                const willRunOutSoon = item.has_sales_data && item.days_remaining < 14;
                const isOutOfStock = item.quantity_lbs <= 0;
                return isLowStock || willRunOutSoon || isOutOfStock;
            });

            // Sort: out of stock first, then by days remaining, then by stock level
            return atRisk
                .sort((a, b) => {
                    // Out of stock items first
                    if (a.quantity_lbs <= 0 && b.quantity_lbs > 0) return -1;
                    if (b.quantity_lbs <= 0 && a.quantity_lbs > 0) return 1;
                    // Then by days remaining (items with sales data)
                    if (a.has_sales_data && b.has_sales_data) {
                        return a.days_remaining - b.days_remaining;
                    }
                    // Items with sales data before those without
                    if (a.has_sales_data && !b.has_sales_data) return -1;
                    if (!a.has_sales_data && b.has_sales_data) return 1;
                    // Finally by stock level
                    return a.quantity_lbs - b.quantity_lbs;
                })
                .slice(0, 5); // Top 5 at risk
        },
        enabled: !!tenantId,
        staleTime: 60000, // Cache for 1 minute
    });

    if (isLoading) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Inventory Forecast</CardTitle>
                </CardHeader>
                <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                    Analyzing sales trends...
                </CardContent>
            </Card>
        );
    }

    if (!atRiskItems || atRiskItems.length === 0) {
        return null; // Don't show if inventory is healthy
    }

    return (
        <Card className="glass-card border-orange-200/50 bg-orange-50/30 dark:bg-orange-900/10 dark:border-orange-800/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                        <CalendarClock className="h-5 w-5" />
                        Stockout Forecast
                    </CardTitle>
                    <Badge variant="outline" className="bg-white/50 border-orange-200 text-orange-700">
                        {atRiskItems.length} items at risk
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {atRiskItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white dark:bg-card p-3 rounded-lg border shadow-sm">
                            <div className="space-y-1">
                                <div className="font-medium flex items-center gap-2">
                                    {item.product_name}
                                    <InventoryStatusBadge
                                        quantity={item.quantity_lbs}
                                        lowStockThreshold={item.reorder_point}
                                        showLabel={false}
                                        className="h-5 px-1.5"
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>{item.quantity_lbs.toFixed(1)} lbs left</span>
                                    <span>•</span>
                                    {item.has_sales_data ? (
                                        <span>~{item.daily_velocity.toFixed(1)} lbs/day</span>
                                    ) : (
                                        <span className="text-amber-600 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            No recent sales
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    {item.quantity_lbs <= 0 ? (
                                        <div className="text-sm font-bold text-red-600">
                                            Out of Stock
                                        </div>
                                    ) : item.has_sales_data ? (
                                        <div className={`text-sm font-bold ${item.days_remaining < 3 ? 'text-red-600' : 'text-orange-600'}`}>
                                            {item.days_remaining < 1 ? '< 1 day' : `${item.days_remaining} days`}
                                        </div>
                                    ) : (
                                        <div className="text-sm font-bold text-amber-600">
                                            Low Stock
                                        </div>
                                    )}
                                    <div className="text-[10px] text-muted-foreground">
                                        {item.quantity_lbs <= 0 ? 'restock needed' : item.has_sales_data ? 'until empty' : `below ${item.reorder_point}`}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => navigate(`/${tenantSlug}/admin/inventory/products?highlight=${item.id}&search=${encodeURIComponent(item.product_name)}`)}
                                >
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
