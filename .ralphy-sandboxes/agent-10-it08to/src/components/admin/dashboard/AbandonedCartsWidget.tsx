/**
 * Abandoned Carts Widget for Admin Dashboard
 * Shows recent abandoned carts with recovery suggestions
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  ArrowRight,
  Clock,
  DollarSign,
  TrendingDown,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useAbandonedCarts } from '@/hooks/useAbandonedCarts';
import { logger } from '@/lib/logger';

export function AbandonedCartsWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();

  const getFullPath = (path: string) => {
    if (!tenantSlug) return path;
    if (path.startsWith('/admin')) {
      return `/${tenantSlug}${path}`;
    }
    return path;
  };

  const {
    abandonedCarts,
    stats,
    isLoading,
    error,
    getFollowUpSuggestions,
  } = useAbandonedCarts({
    tenantId: tenant?.id,
    enabled: !!tenant?.id,
    limit: 5,
    includeRecovered: false,
  });

  if (error) {
    logger.error('Failed to load abandoned carts widget', error, 'AbandonedCartsWidget');
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="h-5 w-5 mr-2" />
          Failed to load abandoned carts
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Abandoned Carts
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(getFullPath('/admin/abandoned-carts'))}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Stats Summary */}
      {!isLoading && stats && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-destructive">
              {stats.total_abandoned}
            </div>
            <div className="text-xs text-muted-foreground">Abandoned</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              ${stats.total_value.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Potential Revenue</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">
              {stats.recovery_rate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Recovery Rate</div>
          </div>
        </div>
      )}

      {/* Abandoned Carts List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))
        ) : abandonedCarts.length > 0 ? (
          abandonedCarts.map((cart) => {
            const suggestions = getFollowUpSuggestions(cart);
            const itemCount = cart.cart_items?.length || 0;

            return (
              <div
                key={cart.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {cart.customer_name || cart.customer_email || 'Anonymous'}
                      {cart.customer_email && (
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(cart.created_at), { addSuffix: true })}
                      <span className="mx-1">|</span>
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {cart.total_value.toLocaleString()}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs capitalize"
                    >
                      {cart.source}
                    </Badge>
                  </div>
                  {suggestions.length > 0 && cart.customer_email && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(getFullPath(`/admin/abandoned-carts/${cart.id}`));
                      }}
                    >
                      Recover
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No abandoned carts</p>
            <p className="text-sm">Great job! All carts are completing checkout.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
