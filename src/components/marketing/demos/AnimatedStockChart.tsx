import { motion } from 'framer-motion';
import { TrendingUp, Package } from 'lucide-react';

const stockData = [
  { name: 'Product A', stock: 85, trend: 'up' },
  { name: 'Product B', stock: 45, trend: 'down' },
  { name: 'Product C', stock: 92, trend: 'up' },
  { name: 'Product D', stock: 20, trend: 'down' },
];

export function AnimatedStockChart() {
  return (
    <div className="w-full h-full bg-card/50 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Package className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">Live Stock Levels</h4>
      </div>

      <div className="space-y-4">
        {stockData.map((item, index) => (
          <motion.div
            key={item.name}
            className="space-y-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay: index * 0.05,
            }}
          >
            <div className="flex justify-between items-center text-sm">
              <span className="text-foreground font-medium">{item.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{item.stock} units</span>
                <TrendingUp 
                  className={`h-4 w-4 ${
                    item.trend === 'up' ? 'text-green-500 rotate-0' : 'text-red-500 rotate-180'
                  }`}
                />
              </div>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  item.stock > 70 ? 'bg-green-500' : 
                  item.stock > 30 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${item.stock}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-sm text-foreground font-medium">Low Stock Alert</div>
        <div className="text-xs text-muted-foreground mt-1">Product D needs restock</div>
      </motion.div>
    </div>
  );
}
