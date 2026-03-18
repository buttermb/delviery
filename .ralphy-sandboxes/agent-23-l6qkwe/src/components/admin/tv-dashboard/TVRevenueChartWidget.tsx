/**
 * TVRevenueChartWidget Component
 *
 * Hourly revenue bar chart for TV display:
 * - Shows sales by hour for today
 * - Current hour highlighted
 * - Large, readable axis labels
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { chartSemanticColors } from '@/lib/chartColors';

export interface HourlyRevenue {
    hour: number;
    revenue: number;
}

interface TVRevenueChartWidgetProps {
    data: HourlyRevenue[];
}

export function TVRevenueChartWidget({ data }: TVRevenueChartWidgetProps) {
    const currentHour = new Date().getHours();

    // Fill in missing hours with 0 revenue
    const chartData = useMemo(() => {
        const hourlyMap = new Map(data.map(d => [d.hour, d.revenue]));
        const result = [];

        // Show hours from 6am to 11pm (typical business hours)
        for (let h = 6; h <= 23; h++) {
            result.push({
                hour: h,
                revenue: hourlyMap.get(h) ?? 0,
                label: h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`,
                isCurrent: h === currentHour,
            });
        }
        return result;
    }, [data, currentHour]);

    const maxRevenue = Math.max(...chartData.map(d => d.revenue), 100);

    const formatYAxis = (value: number) => {
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value}`;
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-semibold text-zinc-300 mb-4 px-2">Hourly Revenue</h2>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#a1a1aa', fontSize: 14 }}
                            interval={1}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#a1a1aa', fontSize: 14 }}
                            tickFormatter={formatYAxis}
                            domain={[0, maxRevenue * 1.1]}
                            width={60}
                        />
                        <Bar
                            dataKey="revenue"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={50}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isCurrent ? chartSemanticColors.revenue : chartSemanticColors.muted}
                                    fillOpacity={entry.isCurrent ? 1 : 0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-2 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-zinc-600" />
                    <span className="text-zinc-400">Previous Hours</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500" />
                    <span className="text-zinc-400">Current Hour</span>
                </div>
            </div>
        </div>
    );
}
