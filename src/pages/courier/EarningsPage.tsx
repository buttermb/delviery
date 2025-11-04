import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
} from 'lucide-react';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';

interface Earning {
  id: string;
  order_id: string;
  order_total: number;
  commission_amount: number;
  tip_amount: number;
  bonus_amount: number;
  total_earned: number;
  created_at: string;
  order_number: string;
}

export default function CourierEarningsPage() {
  const { courier } = useCourier();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const navigate = useNavigate();

  useEffect(() => {
    if (courier) {
      loadEarnings();
    }
  }, [courier, timeframe]);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date = new Date();

      switch (timeframe) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
          endDate = endOfWeek(new Date(), { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
      }

      const { data, error } = await supabase
        .from('courier_earnings')
        .select(`
          *,
          orders:order_id (
            order_number
          )
        `)
        .eq('courier_id', courier?.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedEarnings = data?.map((e: any) => ({
        ...e,
        order_number: e.orders?.order_number || 'N/A',
      })) || [];

      setEarnings(formattedEarnings);
    } catch (error) {
      console.error('Failed to load earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = earnings.reduce(
    (acc, e) => ({
      commission: acc.commission + parseFloat(e.commission_amount.toString()),
      tips: acc.tips + parseFloat((e.tip_amount || 0).toString()),
      bonuses: acc.bonuses + parseFloat((e.bonus_amount || 0).toString()),
      total: acc.total + parseFloat(e.total_earned.toString()),
    }),
    { commission: 0, tips: 0, bonuses: 0, total: 0 }
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Earnings</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Timeframe Tabs */}
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totals.total.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totals.commission.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totals.tips.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bonuses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totals.bonuses.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Earnings List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Earnings History</CardTitle>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading earnings...</p>
            ) : earnings.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">No earnings in this period</p>
              </div>
            ) : (
              <div className="space-y-4">
                {earnings.map((earning) => (
                  <Card key={earning.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">Order #{earning.order_number}</h3>
                            <Badge variant="outline">Delivered</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(earning.created_at), 'MMM dd, yyyy h:mm a')}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Commission:</span>{' '}
                              <span className="font-medium">
                                ${parseFloat(earning.commission_amount.toString()).toFixed(2)}
                              </span>
                            </div>
                            {earning.tip_amount > 0 && (
                              <div>
                                <span className="text-muted-foreground">Tip:</span>{' '}
                                <span className="font-medium text-green-600">
                                  ${parseFloat(earning.tip_amount.toString()).toFixed(2)}
                                </span>
                              </div>
                            )}
                            {earning.bonus_amount > 0 && (
                              <div>
                                <span className="text-muted-foreground">Bonus:</span>{' '}
                                <span className="font-medium text-blue-600">
                                  ${parseFloat(earning.bonus_amount.toString()).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            ${parseFloat(earning.total_earned.toString()).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
