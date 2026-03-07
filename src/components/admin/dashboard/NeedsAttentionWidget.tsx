/**
 * Needs Your Attention Widget
 * Shows a flat list of actionable attention items with buttons
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate, useParams } from 'react-router-dom';
import { useAttentionQueue } from '@/hooks/useAttentionQueue';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  Truck,
  Users,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { AlertCategory } from '@/types/hotbox';

const CATEGORY_ICONS: Record<AlertCategory, React.ReactNode> = {
  orders: <ShoppingCart className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  delivery: <Truck className="h-4 w-4" />,
  customers: <Users className="h-4 w-4" />,
  compliance: <AlertTriangle className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  financial: <AlertTriangle className="h-4 w-4" />,
  system: <AlertTriangle className="h-4 w-4" />,
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  important: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function NeedsAttentionWidget() {
  const { queue, isLoading, counts } = useAttentionQueue();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const items = queue?.items?.slice(0, 5) ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-3 text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="text-sm">Nothing needs your attention right now.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Needs Your Attention
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {counts.total} {counts.total === 1 ? 'item' : 'items'}
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => navigate(`/${tenantSlug}/admin/hotbox`)}
          >
            View all
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority] ?? 'bg-gray-400'}`} />
            <span className="text-muted-foreground shrink-0">
              {CATEGORY_ICONS[item.category] ?? <AlertTriangle className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{item.title}</span>
              {item.description && (
                <span className="text-xs text-muted-foreground truncate block">{item.description}</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-7 text-xs"
              onClick={() => navigate(item.actionUrl)}
            >
              {item.actionLabel}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
