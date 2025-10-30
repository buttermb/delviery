import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { EarningsStats } from '@/components/courier/EarningsStats';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';

interface Earning {
  id: string;
  order_id: string;
  order_total: number;
  commission_rate: number;
  commission_amount: number;
  tip_amount: number;
  bonus_amount: number;
  total_earned: number;
  created_at: string;
  status: string;
  week_start_date: string;
}

interface Summary {
  total: number;
  commission: number;
  tips: number;
  bonuses: number;
  deliveries: number;
  avgPerDelivery: number;
}

export default function CourierEarnings() {
  const { courier, loading: courierLoading } = useCourier();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    commission: 0,
    tips: 0,
    bonuses: 0,
    deliveries: 0,
    avgPerDelivery: 0
  });

  // Use optimized query hook
  const { data: earningsData, isLoading } = useOptimizedQuery(
    ['courier-earnings', period],
    async () => {
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'earnings', period }
      });
      if (error) throw error;
      return data;
    },
    {
      enabled: !!courier,
      staleTime: 60000, // 1 minute
    }
  );

  useEffect(() => {
    if (earningsData?.earnings) {
      setEarnings(earningsData.earnings);
      
      // Calculate summary
      const total = earningsData.earnings.reduce((sum: number, e: Earning) => sum + parseFloat(e.total_earned.toString()), 0);
      const commission = earningsData.earnings.reduce((sum: number, e: Earning) => sum + parseFloat(e.commission_amount.toString()), 0);
      const tips = earningsData.earnings.reduce((sum: number, e: Earning) => sum + parseFloat((e.tip_amount || 0).toString()), 0);
      const bonuses = earningsData.earnings.reduce((sum: number, e: Earning) => sum + parseFloat((e.bonus_amount || 0).toString()), 0);
      const deliveries = earningsData.earnings.length;
      
      setSummary({
        total,
        commission,
        tips,
        bonuses,
        deliveries,
        avgPerDelivery: deliveries > 0 ? total / deliveries : 0
      });
    }
  }, [earningsData]);

  if (courierLoading || isLoading || !courier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary/90 to-primary text-primary-foreground sticky top-0 z-50 shadow-md" role="banner">
        <div className="p-6">
          <button
            onClick={() => navigate('/courier/dashboard')}
            className="flex items-center mb-4 touch-manipulation active:scale-95 transition-transform"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold mb-2">💰 Your Earnings</h1>
          <p className="opacity-90">Track your income and payments</p>
        </div>
      </header>

      {/* Period Selector */}
      <div className="p-4">
        <Card className="p-2 flex gap-2">
          {(['week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`
                flex-1 py-2.5 rounded-lg font-semibold transition-all touch-manipulation active:scale-95
                ${period === p 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
              aria-label={`View ${p === 'week' ? 'this week' : p === 'month' ? 'this month' : 'all time'} earnings`}
              aria-pressed={period === p}
            >
              {p === 'week' && 'This Week'}
              {p === 'month' && 'This Month'}
              {p === 'all' && 'All Time'}
            </button>
          ))}
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="px-4 mb-6">
        <EarningsStats
          total={summary.total}
          commission={summary.commission}
          tips={summary.tips}
          bonuses={summary.bonuses}
          deliveries={summary.deliveries}
          avgPerDelivery={summary.avgPerDelivery}
          isLoading={isLoading}
        />
      </div>

      {/* Earnings List */}
      <div className="px-4">
        <h3 className="font-bold text-lg mb-3">Recent Earnings</h3>
        {earnings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No earnings for this period</p>
          </div>
        ) : (
          <div className="space-y-2">
            {earnings.map(earning => (
              <Card key={earning.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">
                      Order #{earning.order_id.substring(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(earning.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      ${parseFloat(earning.total_earned.toString()).toFixed(2)}
                    </p>
                    <Badge 
                      variant={earning.status === 'paid' ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      {earning.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>Commission: ${parseFloat(earning.commission_amount.toString()).toFixed(2)}</span>
                  {earning.tip_amount > 0 && (
                    <span>Tip: ${parseFloat(earning.tip_amount.toString()).toFixed(2)}</span>
                  )}
                  {earning.bonus_amount > 0 && (
                    <span className="text-purple-600">Bonus: ${parseFloat(earning.bonus_amount.toString()).toFixed(2)}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
