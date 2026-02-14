import { useState } from 'react';
import { format } from 'date-fns';
import {
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  Wrench,
  ShoppingCart,
  RotateCcw,
  Truck,
  Trash2,
  Loader2,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInventoryHistory, type InventoryHistoryEntry, type InventoryHistoryFilters } from '@/hooks/useInventoryHistory';

interface InventoryHistoryTimelineProps {
  productId?: string;
  className?: string;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Package; colorClass: string }> = {
  stock_in: { label: 'Stock In', icon: ArrowUpCircle, colorClass: 'bg-green-100 text-green-600 border-green-200' },
  stock_out: { label: 'Stock Out', icon: ArrowDownCircle, colorClass: 'bg-red-100 text-red-600 border-red-200' },
  transfer: { label: 'Transfer', icon: ArrowRightLeft, colorClass: 'bg-blue-100 text-blue-600 border-blue-200' },
  adjustment: { label: 'Adjustment', icon: Wrench, colorClass: 'bg-yellow-100 text-yellow-600 border-yellow-200' },
  sale: { label: 'Sale', icon: ShoppingCart, colorClass: 'bg-purple-100 text-purple-600 border-purple-200' },
  return: { label: 'Return', icon: RotateCcw, colorClass: 'bg-orange-100 text-orange-600 border-orange-200' },
  receiving: { label: 'Receiving', icon: Truck, colorClass: 'bg-teal-100 text-teal-600 border-teal-200' },
  disposal: { label: 'Disposal', icon: Trash2, colorClass: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function getChangeTypeConfig(changeType: string) {
  return CHANGE_TYPE_CONFIG[changeType] || {
    label: changeType,
    icon: Package,
    colorClass: 'bg-muted text-muted-foreground border-border',
  };
}

function formatChangeAmount(amount: number): string {
  if (amount > 0) return `+${amount}`;
  return String(amount);
}

export function InventoryHistoryTimeline({ productId, className }: InventoryHistoryTimelineProps) {
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all');

  const filters: InventoryHistoryFilters = {
    productId,
    changeType: changeTypeFilter !== 'all' ? changeTypeFilter : undefined,
  };

  const { data: history, isLoading, error } = useInventoryHistory(filters);

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Inventory History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive py-4">
            Failed to load inventory history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Inventory History</CardTitle>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="stock_in">Stock In</SelectItem>
              <SelectItem value="stock_out">Stock Out</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="return">Return</SelectItem>
              <SelectItem value="receiving">Receiving</SelectItem>
              <SelectItem value="disposal">Disposal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !history || history.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No inventory history recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <HistoryEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface HistoryEntryRowProps {
  entry: InventoryHistoryEntry;
}

function HistoryEntryRow({ entry }: HistoryEntryRowProps) {
  const config = getChangeTypeConfig(entry.change_type);
  const Icon = config.icon;
  const isPositive = entry.change_amount > 0;

  return (
    <div className="flex gap-3 items-start">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${config.colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col gap-1 pb-4 border-b last:border-0 last:pb-0 w-full min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs shrink-0">
                {config.label}
              </Badge>
              {entry.product && (
                <span className="text-sm font-medium truncate">
                  {entry.product.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {formatChangeAmount(entry.change_amount)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({entry.previous_quantity} &rarr; {entry.new_quantity})
              </span>
            </div>
            {entry.reason && (
              <p className="text-xs text-muted-foreground mt-1">{entry.reason}</p>
            )}
            {entry.notes && (
              <p className="text-xs text-muted-foreground italic mt-0.5">{entry.notes}</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {format(new Date(entry.created_at), 'MMM d, h:mm a')}
          </span>
        </div>
        {entry.reference_type && (
          <p className="text-xs text-muted-foreground">
            Ref: {entry.reference_type}
            {entry.reference_id ? ` #${entry.reference_id.slice(0, 8)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
