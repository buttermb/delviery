import { useNavigate } from 'react-router-dom';
import { Clock, ShoppingCart, Package, Users, Truck, FileText, X } from 'lucide-react';

import { useRecentItems, type RecentItem } from '@/hooks/useRecentItems';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger } from '@/lib/logger';

function getItemIcon(type: RecentItem['type']) {
  switch (type) {
    case 'order':
      return <ShoppingCart className="h-4 w-4 text-blue-600" />;
    case 'product':
      return <Package className="h-4 w-4 text-emerald-600" />;
    case 'client':
      return <Users className="h-4 w-4 text-purple-600" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function AdminRecentItemsList() {
  const { items, clearRecentItems } = useRecentItems();
  const navigate = useNavigate();

  const handleItemClick = (path: string) => {
    logger.info('[RecentItems] Item clicked', { path });
    navigate(path);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              Recent Items
            </CardTitle>
            <CardDescription>Quick access to recently viewed items</CardDescription>
          </div>
          {items.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearRecentItems}
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => handleItemClick(item.path)}
              >
                <div className="p-2 bg-muted rounded-lg">
                  {getItemIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                  {item.subLabel && (
                    <p className="text-xs text-muted-foreground truncate">{item.subLabel}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
