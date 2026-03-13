/**
 * MenuComparisonView Component
 * Task 293: Create menu comparison view
 *
 * Side-by-side comparison of multiple menus with key metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatSmartDate } from '@/lib/formatters';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Package from 'lucide-react/dist/esm/icons/package';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Shield from 'lucide-react/dist/esm/icons/shield';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';

interface Menu {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  expiration_date?: string | null;
  view_count?: number;
  product_count?: number;
  revenue?: number;
  is_encrypted?: boolean;
  device_locking_enabled?: boolean;
  screenshot_protection_enabled?: boolean;
}

interface MenuComparisonViewProps {
  menus: Menu[];
  onSelectMenu?: (menuId: string) => void;
  className?: string;
}

const COMPARISON_ROWS = [
  { label: 'Status', key: 'status', icon: Badge },
  { label: 'Created', key: 'created_at', icon: Calendar },
  { label: 'Expires', key: 'expiration_date', icon: Calendar },
  { label: 'Views', key: 'view_count', icon: Eye },
  { label: 'Products', key: 'product_count', icon: Package },
  { label: 'Revenue', key: 'revenue', icon: DollarSign },
  { label: 'Encrypted', key: 'is_encrypted', icon: Shield },
  { label: 'Device Lock', key: 'device_locking_enabled', icon: Shield },
  { label: 'Screenshot Protection', key: 'screenshot_protection_enabled', icon: Shield },
];

export function MenuComparisonView({ menus, onSelectMenu, className }: MenuComparisonViewProps) {
  const renderValue = (menu: Menu, key: string) => {
    const value = menu[key as keyof Menu];

    switch (key) {
      case 'status':
        return (
          <Badge
            variant={
              value === 'active'
                ? 'default'
                : value === 'inactive'
                  ? 'secondary'
                  : 'destructive'
            }
            className="capitalize"
          >
            {String(value)}
          </Badge>
        );

      case 'created_at':
      case 'expiration_date':
        return value ? (
          <span className="text-sm">{formatSmartDate(String(value))}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );

      case 'view_count':
      case 'product_count':
        return (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{value ?? 0}</span>
          </div>
        );

      case 'revenue':
        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-emerald-600">
              ${((value as number) ?? 0).toFixed(2)}
            </span>
          </div>
        );

      case 'is_encrypted':
      case 'device_locking_enabled':
      case 'screenshot_protection_enabled':
        return value ? (
          <Check className="h-5 w-5 text-emerald-600" />
        ) : (
          <X className="h-5 w-5 text-muted-foreground" />
        );

      default:
        return <span className="text-sm">{String(value ?? '—')}</span>;
    }
  };

  if (menus.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No menus to compare</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Menu Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-full">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold sticky left-0 bg-background z-10">
                    Feature
                  </th>
                  {menus.map((menu) => (
                    <th
                      key={menu.id}
                      className="py-3 px-4 min-w-[200px] font-semibold text-center"
                    >
                      <div className="space-y-2">
                        <div className="font-bold truncate" title={menu.name}>
                          {menu.name}
                        </div>
                        {onSelectMenu && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectMenu(menu.id)}
                            className="w-full"
                          >
                            View Menu
                          </Button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, index) => (
                  <tr
                    key={row.key}
                    className={cn(
                      'border-b hover:bg-muted/50 transition-colors',
                      index % 2 === 0 && 'bg-muted/20'
                    )}
                  >
                    <td className="py-3 px-4 font-medium sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <row.icon className="h-4 w-4 text-muted-foreground" />
                        {row.label}
                      </div>
                    </td>
                    {menus.map((menu) => (
                      <td key={menu.id} className="py-3 px-4 text-center">
                        {renderValue(menu, row.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{menus.length}</p>
              <p className="text-sm text-muted-foreground">Menus Compared</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {menus.reduce((sum, m) => sum + (m.view_count ?? 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                ${menus.reduce((sum, m) => sum + (m.revenue ?? 0), 0).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
