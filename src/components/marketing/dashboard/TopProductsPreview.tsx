import { motion } from 'framer-motion';
import { TrendingUp, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockDashboardData } from '../mockDashboardData';

export function TopProductsPreview() {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 2: return 'bg-slate-500/20 text-slate-700 border-slate-500/30';
      case 3: return 'bg-amber-500/20 text-amber-700 border-amber-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Top Products
        </h3>
      </div>

      <div className="space-y-2">
        {mockDashboardData.topProducts.slice(0, 3).map((product, index) => (
          <motion.div
            key={product.rank}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              delay: index * 0.1,
              duration: 0.4,
              ease: [0.21, 0.47, 0.32, 0.98]
            }}
            whileHover={{ 
              scale: 1.01,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
          >
            {/* Rank Badge */}
            <Badge 
              variant="outline" 
              className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${getRankColor(product.rank)}`}
            >
              {product.rank}
            </Badge>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{product.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {product.orders} orders
              </div>
            </div>

            {/* Revenue */}
            <div className="text-right">
              <div className="text-sm font-semibold">${product.revenue.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5" />
                {product.trend}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
