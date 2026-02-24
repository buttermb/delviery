/**
 * Product Inventory Chart
 * Shows stock levels over time with restock/deduction events
 * Time range selector: 7d/30d/90d
 */

import { useState } from 'react';
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Scatter,
    ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { useProductInventoryChart } from '@/hooks/useProduct';
import type { InventoryChartDataPoint } from '@/hooks/useProduct';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';

interface ProductInventoryChartProps {
    productId: string | undefined;
}

type TimeRange = '7d' | '30d' | '90d';

interface ChartDataPoint {
    date: string;
    quantity: number;
    displayDate: string;
    eventType: 'restock' | 'deduction' | 'adjustment';
    notes?: string;
    restockDot?: number;
    deductionDot?: number;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        payload: ChartDataPoint;
    }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const data = payload[0].payload;

    return (
        <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[180px]">
            <p className="text-sm font-medium mb-1">{data.displayDate}</p>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground text-sm">Stock Level:</span>
                <span className="font-bold">{data.quantity}</span>
            </div>
            <div className="flex items-center gap-1">
                {data.eventType === 'restock' && (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Restock
                    </Badge>
                )}
                {data.eventType === 'deduction' && (
                    <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Order/Deduction
                    </Badge>
                )}
                {data.eventType === 'adjustment' && (
                    <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                        Adjustment
                    </Badge>
                )}
            </div>
            {data.notes && (
                <p className="text-xs text-muted-foreground mt-2 max-w-[200px] truncate">
                    {data.notes}
                </p>
            )}
        </div>
    );
}

export function ProductInventoryChart({ productId }: ProductInventoryChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');

    const { data: chartData = [], isLoading, error } = useProductInventoryChart(productId, timeRange);

    // Transform data for chart display
    const formattedData: ChartDataPoint[] = chartData.map((point: InventoryChartDataPoint) => ({
        date: point.date,
        quantity: point.quantity,
        displayDate: format(new Date(point.date), 'MMM d, yyyy h:mm a'),
        eventType: point.eventType,
        notes: point.notes,
        // Add scatter dots for events
        restockDot: point.eventType === 'restock' ? point.quantity : undefined,
        deductionDot: point.eventType === 'deduction' ? point.quantity : undefined,
    }));

    // Calculate stats
    const currentStock = formattedData.length > 0 ? formattedData[formattedData.length - 1].quantity : 0;
    const minStock = formattedData.length > 0 ? Math.min(...formattedData.map(d => d.quantity)) : 0;
    const maxStock = formattedData.length > 0 ? Math.max(...formattedData.map(d => d.quantity)) : 0;
    const restockCount = formattedData.filter(d => d.eventType === 'restock').length;
    const deductionCount = formattedData.filter(d => d.eventType === 'deduction').length;

    const handleTimeRangeChange = (value: string) => {
        if (value) {
            setTimeRange(value as TimeRange);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Inventory History Chart
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Inventory History Chart
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center text-destructive">
                        Failed to load inventory history
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Inventory History Chart
                        </CardTitle>
                        <CardDescription>
                            Stock levels over time with restock and order events
                        </CardDescription>
                    </div>
                    <ToggleGroup
                        type="single"
                        value={timeRange}
                        onValueChange={handleTimeRangeChange}
                        className="justify-start"
                    >
                        <ToggleGroupItem value="7d" aria-label="7 days" className="text-xs">
                            7d
                        </ToggleGroupItem>
                        <ToggleGroupItem value="30d" aria-label="30 days" className="text-xs">
                            30d
                        </ToggleGroupItem>
                        <ToggleGroupItem value="90d" aria-label="90 days" className="text-xs">
                            90d
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardHeader>
            <CardContent>
                {formattedData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                        No inventory movements in the selected time range
                    </div>
                ) : (
                    <>
                        {/* Stats Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">Current</p>
                                <p className="text-lg font-bold">{currentStock}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">Min</p>
                                <p className="text-lg font-bold">{minStock}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">Max</p>
                                <p className="text-lg font-bold">{maxStock}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    Restocks
                                </p>
                                <p className="text-lg font-bold text-green-600">{restockCount}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    Orders
                                </p>
                                <p className="text-lg font-bold text-red-600">{deductionCount}</p>
                            </div>
                        </div>

                        {/* Chart */}
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={formattedData}>
                                <defs>
                                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(value: string) => {
                                        const date = new Date(value);
                                        return timeRange === '7d'
                                            ? format(date, 'EEE')
                                            : timeRange === '30d'
                                            ? format(date, 'MMM d')
                                            : format(date, 'MMM d');
                                    }}
                                    className="text-muted-foreground"
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    className="text-muted-foreground"
                                    domain={[0, 'auto']}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="stepAfter"
                                    dataKey="quantity"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                    fill="url(#colorStock)"
                                    name="Stock Level"
                                />
                                {/* Green dots for restocks */}
                                <Scatter
                                    dataKey="restockDot"
                                    fill="#22c55e"
                                    shape="circle"
                                    name="Restock"
                                />
                                {/* Red dots for deductions */}
                                <Scatter
                                    dataKey="deductionDot"
                                    fill="#ef4444"
                                    shape="circle"
                                    name="Order/Deduction"
                                />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-muted-foreground">Restock Events</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-muted-foreground">Order Deductions</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
