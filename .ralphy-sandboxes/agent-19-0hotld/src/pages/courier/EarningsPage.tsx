import { useState } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useCourier } from '@/contexts/CourierContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useUnifiedEarnings } from '@/hooks/useUnifiedEarnings';
import { RoleIndicator } from '@/components/courier/RoleIndicator';
import {
  ArrowLeft,
  DollarSign,
  Download,
  Package,
  Truck,
} from 'lucide-react';
import { format } from 'date-fns';

export default function CourierEarningsPage() {
  const { courier, role } = useCourier();
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const navigate = useNavigate();

  const { data, isLoading } = useUnifiedEarnings(role, courier?.id, timeframe);

  const earnings = data?.earnings ?? [];
  const totals = data?.totals || { commission: 0, tips: 0, bonuses: 0, deliveryFees: 0, total: 0 };

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')} aria-label="Back to courier dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Earnings</h1>
            <RoleIndicator role={role} />
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Timeframe Tabs */}
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as 'today' | 'week' | 'month')}>
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

          {role === 'courier' ? (
            <>
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
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Delivery Fees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totals.deliveryFees.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Deliveries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{earnings.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg per Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${earnings.length > 0 ? (totals.total / earnings.length).toFixed(2) : '0.00'}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
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
            {isLoading ? (
              <EnhancedLoadingState variant="list" count={5} message="Loading earnings..." />
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
                            {earning.type === 'courier' ? (
                              <Package className="h-4 w-4 text-primary" />
                            ) : (
                              <Truck className="h-4 w-4 text-primary" />
                            )}
                            <h3 className="font-semibold">
                              {earning.type === 'courier' ? 'Order' : 'Delivery'} #{earning.order_number}
                            </h3>
                            <Badge variant="outline">Delivered</Badge>
                          </div>
                          {earning.type === 'runner' && earning.client_name && (
                            <p className="text-sm text-muted-foreground">{earning.client_name}</p>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(earning.created_at), 'MMM dd, yyyy h:mm a')}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {earning.type === 'courier' ? (
                              <>
                                {earning.commission_amount !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Commission:</span>{' '}
                                    <span className="font-medium">
                                      ${earning.commission_amount.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {earning.tip_amount && earning.tip_amount > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Tip:</span>{' '}
                                    <span className="font-medium text-green-600">
                                      ${earning.tip_amount.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {earning.bonus_amount && earning.bonus_amount > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Bonus:</span>{' '}
                                    <span className="font-medium text-blue-600">
                                      ${earning.bonus_amount.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div>
                                <span className="text-muted-foreground">Delivery Fee:</span>{' '}
                                <span className="font-medium">
                                  ${earning.delivery_fee?.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            ${earning.total_earned.toFixed(2)}
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
