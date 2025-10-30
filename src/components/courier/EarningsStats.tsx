import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, Package } from 'lucide-react';

interface EarningsStatsProps {
  total: number;
  commission: number;
  tips: number;
  bonuses: number;
  deliveries: number;
  avgPerDelivery: number;
  isLoading?: boolean;
}

export const EarningsStats = memo(({
  total,
  commission,
  tips,
  bonuses,
  deliveries,
  avgPerDelivery,
  isLoading = false
}: EarningsStatsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="bg-muted rounded-2xl h-40" />
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-xl h-24" />
          <div className="bg-muted rounded-xl h-24" />
          <div className="bg-muted rounded-xl h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Total Card */}
      <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground p-6 shadow-strong">
        <p className="text-sm opacity-90 mb-2">Total Earned</p>
        <p className="text-5xl font-black mb-4" aria-label={`Total earned: $${total.toFixed(2)}`}>
          ${total.toFixed(2)}
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{deliveries}</p>
            <p className="text-xs opacity-75">Deliveries</p>
          </div>
          <div>
            <p className="text-2xl font-bold">${avgPerDelivery.toFixed(2)}</p>
            <p className="text-xs opacity-75">Avg/Order</p>
          </div>
          <div>
            <p className="text-2xl font-bold">${tips.toFixed(2)}</p>
            <p className="text-xs opacity-75">Tips</p>
          </div>
        </div>
      </Card>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <DollarSign className="w-6 h-6 mx-auto mb-2 text-primary" aria-hidden="true" />
          <p className="text-2xl font-bold text-primary">${commission.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Commission</p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" aria-hidden="true" />
          <p className="text-2xl font-bold text-green-600">${tips.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Tips</p>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-6 h-6 mx-auto mb-2 text-purple-600" aria-hidden="true" />
          <p className="text-2xl font-bold text-purple-600">${bonuses.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Bonuses</p>
        </Card>
      </div>
    </div>
  );
});

EarningsStats.displayName = 'EarningsStats';
