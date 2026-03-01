import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mockDashboardData } from '../mockDashboardData';
import { useState } from 'react';

export function SalesChartPreview() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const salesData = mockDashboardData.salesChart.slice(0, 5);
  const maxAmount = Math.max(...salesData.map(d => d.amount));

  return (
    <div className="p-3 bg-muted/30 rounded-lg border border-border/30 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          Sales Overview
        </h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Last 5 Days</Badge>
      </div>

      {/* Chart */}
      <div className="relative h-[120px] flex items-end justify-between gap-1.5 px-2">
        {salesData.map((data, index) => {
          const height = (data.amount / maxAmount) * 100;

          return (
            <div key={data.day} className="flex-1 flex flex-col items-center gap-1">
              {/* Tooltip */}
              {hoveredBar === index && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-10 bg-popover text-popover-foreground px-1.5 py-0.5 rounded shadow-lg border text-[10px] z-10"
                  style={{ left: `${(index / salesData.length) * 100}%` }}
                >
                  <div className="font-semibold">${data.amount.toLocaleString()}</div>
                  <div className="text-muted-foreground text-[9px]">{data.orders} orders</div>
                </motion.div>
              )}

              {/* Bar */}
              <motion.div
                initial={{ height: "0%" }}
                animate={{ height: `${height}%` }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.6,
                  ease: [0.21, 0.47, 0.32, 0.98]
                }}
                whileHover={{ scaleY: 1.05, originY: 1 }}
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
                className="w-full bg-gradient-to-t from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-primary))/0.7] border-t border-[hsl(var(--marketing-primary))/0.4] rounded-t-md cursor-pointer relative shadow-[inset_0_2px_4px_rgba(255,255,255,0.2)]"
                style={{ minHeight: '20px' }}
              />

              {/* Label */}
              <span className="text-[10px] text-muted-foreground font-medium">{data.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
