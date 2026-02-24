import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/formatters';

interface ProductRanking {
  rank: number;
  product_name: string;
  view_count: number;
  conversion_rate: number;
  revenue?: number;
}

interface TopProductsRankingProps {
  products: ProductRanking[];
  title?: string;
  metric?: 'views' | 'conversions' | 'revenue';
}

export const TopProductsRanking = ({
  products,
  title = 'Top Performing Products',
  metric = 'views'
}: TopProductsRankingProps) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-warning" />;
      default:
        return <div className="h-6 w-6 flex items-center justify-center font-bold text-muted-foreground">{rank}</div>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 2:
        return 'bg-gray-400/10 text-gray-700 border-gray-400/20 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30';
      case 3:
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'conversions':
        return 'Conversion Rate';
      case 'revenue':
        return 'Revenue';
      default:
        return 'Views';
    }
  };

  const formatMetricValue = (product: ProductRanking) => {
    switch (metric) {
      case 'conversions':
        return `${product.conversion_rate.toFixed(1)}%`;
      case 'revenue':
        return formatCurrency(product.revenue ?? 0);
      default:
        return product.view_count.toLocaleString();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Ranked by {getMetricLabel().toLowerCase()}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {products.map((product, index) => (
              <motion.div
                key={product.rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-center">
                  {getRankIcon(product.rank)}
                </div>

                <div className="flex-1">
                  <h4 className="font-semibold text-base">{product.product_name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{product.view_count} views</span>
                    <span>•</span>
                    <span>{product.conversion_rate.toFixed(1)}% conversion</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={getRankBadgeColor(product.rank)}>
                    #{product.rank}
                  </Badge>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatMetricValue(product)}</p>
                    <p className="text-xs text-muted-foreground">{getMetricLabel()}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
