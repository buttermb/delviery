import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { mockDashboardData } from '../mockDashboardData';
import { useState } from 'react';

export function SalesChartPreview() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const salesData = mockDashboardData.salesChart.slice(0, 5);
  const maxAmount = Math.max(...salesData.map(d => d.amount));

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Sales Performance
        </h3>
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <TrendingUp className="h-3 w-3" />
          <span className="font-medium">+12%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[160px] flex items-end justify-between gap-2 px-2">
        {salesData.map((data, index) => {
          const height = (data.amount / maxAmount) * 100;
          
          return (
            <div key={data.day} className="flex-1 flex flex-col items-center gap-1">
              {/* Tooltip */}
              {hoveredBar === index && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-12 bg-popover text-popover-foreground px-2 py-1 rounded shadow-lg border text-xs"
                  style={{ left: `${(index / salesData.length) * 100}%` }}
                >
                  <div className="font-semibold">${data.amount.toLocaleString()}</div>
                  <div className="text-muted-foreground text-[10px]">{data.orders} orders</div>
                </motion.div>
              )}
              
              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ 
                  delay: index * 0.1,
                  duration: 0.6,
                  ease: [0.21, 0.47, 0.32, 0.98]
                }}
                whileHover={{ scaleY: 1.05, originY: 1 }}
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
                className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t cursor-pointer relative"
                style={{ minHeight: '20px' }}
              />
              
              {/* Label */}
              <span className="text-[10px] text-muted-foreground font-medium">{data.day}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
