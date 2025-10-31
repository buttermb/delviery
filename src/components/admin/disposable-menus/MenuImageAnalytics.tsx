import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMenuAnalytics, useProductImageAnalytics } from '@/hooks/useMenuAnalytics';
import { Image, Eye, ZoomIn, ShoppingCart, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface MenuImageAnalyticsProps {
  menuId: string;
}

export const MenuImageAnalytics = ({ menuId }: MenuImageAnalyticsProps) => {
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
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Coverage</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{imageCompletionRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.products_with_images} of {analytics.products_with_images + analytics.products_without_images} products
            </p>
            <Progress value={imageCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.image_views}</div>
            <p className="text-xs text-muted-foreground">
              Total product image views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Zooms</CardTitle>
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.image_zooms}</div>
            <p className="text-xs text-muted-foreground">
              Customers zooming for details
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversion_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Views to orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Image Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {productAnalytics?.map((product) => (
              <div 
                key={product.product_id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {product.has_image ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Image className="h-5 w-5 text-primary" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Image className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{product.product_name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{product.view_count} views</span>
                      <span>•</span>
                      <span>{product.zoom_count} zooms</span>
                      <span>•</span>
                      <span>{product.add_to_cart_count} added to cart</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {product.has_image ? (
                    <Badge variant="default">Has Image</Badge>
                  ) : (
                    <Badge variant="secondary">No Image</Badge>
                  )}
                  {product.conversion_rate > 0 && (
                    <Badge variant="outline">
                      {product.conversion_rate.toFixed(1)}% conv
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {analytics.products_without_images > 0 && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Image className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="font-medium text-yellow-900 dark:text-yellow-100">
                    Add Images to Boost Performance
                  </div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    {analytics.products_without_images} products are missing images. 
                    Products with images typically see 2-3x higher conversion rates.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
