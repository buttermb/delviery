/**
 * Store Card Component
 * Displays individual store information in grid/list view
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Store, 
  ExternalLink, 
  Settings, 
  Trash2, 
  ShoppingCart,
  DollarSign,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface StoreCardProps {
  store: {
    id: string;
    store_name: string;
    slug: string;
    tagline: string | null;
    is_active: boolean;
    total_orders: number;
    total_revenue: number;
    logo_url: string | null;
  };
  isSelected?: boolean;
  onSelect: (storeId: string) => void;
  onPreview: (slug: string) => void;
  onSettings: (storeId: string) => void;
  onDelete: (store: { id: string; store_name: string }) => void;
}

export function StoreCard({
  store,
  isSelected,
  onSelect,
  onPreview,
  onSettings,
  onDelete,
}: StoreCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      }`}
      onClick={() => onSelect(store.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(store.id); } }}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.store_name}
                className="w-12 h-12 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-semibold line-clamp-1" title={store.store_name}>{store.store_name}</h3>
              <p className="text-xs text-muted-foreground">/shop/{store.slug}</p>
            </div>
          </div>
          <Badge variant={store.is_active ? 'default' : 'secondary'} className="shrink-0">
            {store.is_active ? 'Live' : 'Draft'}
          </Badge>
        </div>

        {/* Tagline */}
        {store.tagline && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {store.tagline}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            <span>{store.total_orders} orders</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span>{formatCurrency(store.total_revenue)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1"
            onClick={() => onSelect(store.id)}
          >
            {isSelected ? 'Selected' : 'Open'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreview(store.slug)}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSettings(store.id)}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(store)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Store
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
