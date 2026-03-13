import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Package } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  stock_status?: string;
}

interface MenuPreviewProps {
  menuName: string;
  items: MenuItem[];
}

export function MenuPreview({ menuName, items }: MenuPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Menu Preview: {menuName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="border-b pb-3 last:border-b-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{item.name}</h4>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {item.category && (
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                    )}
                    {item.stock_status && (
                      <Badge
                        variant={item.stock_status === 'in_stock' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {item.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="font-mono font-bold text-lg">${item.price.toFixed(2)}</div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No items in menu</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
