import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMenuAnalytics, useProductImageAnalytics } from '@/hooks/useMenuAnalytics';
import { Image, Eye, ZoomIn, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { AnalyticsExportButton } from './AnalyticsExportButton';
import { AnalyticsDateRangePicker } from './AnalyticsDateRangePicker';
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

interface MenuImageAnalyticsProps {
  menuId: string;
}

export const MenuImageAnalytics = ({ menuId }: MenuImageAnalyticsProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  const { data: analytics, isLoading } = useMenuAnalytics(menuId);
  const { data: productAnalytics } = useProductImageAnalytics(menuId);

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) return null;

  const imageCompletionRate = analytics.products_with_images + analytics.products_without_images > 0
    ? (analytics.products_with_images / (analytics.products_with_images + analytics.products_without_images)) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Filters and Export */}
      <div className="flex flex-wrap items-center gap-4">
        <AnalyticsDateRangePicker 
          dateRange={dateRange} 
          onDateRangeChange={setDateRange} 
        />
        <AnalyticsExportButton 
          data={analytics} 
          filename={`menu-analytics-${menuId}`} 
        />
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Image Coverage</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Image className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{imageCompletionRate.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.products_with_images} of {analytics.products_with_images + analytics.products_without_images} products
              </p>
              <Progress value={imageCompletionRate} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Image Views</CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Eye className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.image_views.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total product image views
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Image Zooms</CardTitle>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <ZoomIn className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.image_zooms.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.image_views > 0 ? `${((analytics.image_zooms / analytics.image_views) * 100).toFixed(1)}% zoom rate` : 'No views yet'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.conversion_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Views to orders
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Product Performance Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader>
            <CardTitle>Product Image Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {productAnalytics?.map((product, index) => (
                <motion.div
                  key={product.product_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {product.has_image ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                        <Image className="h-6 w-6 text-primary" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <AlertCircle className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-base">{product.product_name}</div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{product.view_count}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <ZoomIn className="h-3 w-3" />
                          <span>{product.zoom_count}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" />
                          <span>{product.add_to_cart_count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.has_image ? (
                      <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Has Image</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 border-orange-500/20">No Image</Badge>
                    )}
                    {product.conversion_rate > 0 && (
                      <Badge variant="outline" className="font-semibold">
                        {product.conversion_rate.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Recommendations */}
            {analytics.products_without_images > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.8 }}
                className="mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-yellow-900 dark:text-yellow-100">
                      Add Images to Boost Performance
                    </div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      {analytics.products_without_images} {analytics.products_without_images === 1 ? 'product is' : 'products are'} missing images. 
                      Products with images typically see 2-3x higher conversion rates.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
