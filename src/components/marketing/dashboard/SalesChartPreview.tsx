import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { mockDashboardData } from '../mockDashboardData';
import { useState } from 'react';

export function SalesChartPreview() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const maxAmount = Math.max(...mockDashboardData.salesChart.map(d => d.amount));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Sales Performance (7 Days)
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-emerald-600 font-medium">+12%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[240px] flex items-end justify-between gap-3 mb-6">
        {mockDashboardData.salesChart.map((data, index) => {
          const heightPercent = (data.amount / maxAmount) * 100;
          const isHovered = hoveredBar === index;
          
          return (
            <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
              <motion.div
                className="w-full relative group cursor-pointer"
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-16 left-1/2 -translate-x-1/2 bg-popover border rounded-lg px-3 py-2 shadow-lg z-10 whitespace-nowrap"
                  >
                    <div className="text-xs font-medium">${data.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{data.orders} orders</div>
                  </motion.div>
                )}

                {/* Bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPercent}%` }}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.08,
                    ease: [0.21, 0.47, 0.32, 0.98]
                  }}
                  whileHover={{ scale: 1.05 }}
                  className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-md relative"
                  style={{ minHeight: '20px' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-primary to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-md" />
                </motion.div>
              </motion.div>
              
              {/* Day label */}
              <span className="text-xs text-muted-foreground font-medium">{data.day}</span>
            </div>
          );
        })}
      </div>

      {/* Category breakdown */}
      <div className="pt-4 border-t grid grid-cols-3 gap-4">
        {mockDashboardData.categoryBreakdown.map((category, index) => (
          <motion.div
            key={category.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + index * 0.1 }}
          >
            <div className="text-sm text-muted-foreground mb-1">{category.name}</div>
            <div className="text-lg font-semibold">{category.percentage}%</div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
