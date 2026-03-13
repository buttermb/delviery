import { useNavigate } from 'react-router-dom';
import { Clock, ShoppingCart, Package, Users, Truck, FileText, X } from 'lucide-react';

import { useRecentItems, type RecentItemType } from '@/hooks/useRecentItems';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger } from '@/lib/logger';

function getItemIcon(type: RecentItemType) {
  switch (type) {
    case 'order':
      return <ShoppingCart className="h-4 w-4 text-blue-600" />;
    case 'product':
      return <Package className="h-4 w-4 text-emerald-600" />;
    case 'customer':
      return <Users className="h-4 w-4 text-purple-600" />;
    case 'delivery':
      return <Truck className="h-4 w-4 text-orange-600" />;
    case 'invoice':
      return <FileText className="h-4 w-4 text-yellow-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

export function AdminRecentItemsList() {
  const { recentItems, removeRecentItem, clearRecentItems } = useRecentItems();
  const navigate = useNavigate();

  const handleItemClick = (path: string) => {
    logger.info('[RecentItems] Item clicked', { path });
    navigate(path);
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    logger.info('[RecentItems] Removing item', { id });
    removeRecentItem(id);
  };

  if (recentItems.length === 0) {
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
          {recentItems.length > 0 && (
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
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => handleItemClick(item.path)}
              >
                <div className="p-2 bg-gray-50 rounded-lg">
                  {getItemIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-gray-600 truncate">{item.subtitle}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                  onClick={(e) => handleRemoveItem(item.id, e)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
