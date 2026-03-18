import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DollarSign, Clock, TrendingUp, FileText, AlertTriangle, Receipt, RotateCcw, Loader2 } from 'lucide-react';
import { humanizeError } from '@/lib/humanizeError';
import { useRealtimeShifts, useRealtimeTransactions, useRealtimeCashDrawer } from '@/hooks/useRealtimePOS';
import { queryKeys } from '@/lib/queryKeys';
import { ZReport } from './ZReport';
import { formatSmartDate } from '@/lib/formatters';

interface Shift {
  id: string;
  shift_number: string;
  terminal_id: string;
  cashier_name: string;
  started_at: string;
  ended_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  total_sales: number;
  total_transactions: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  refunds_amount: number | null;
  status: 'open' | 'closed';
}

interface Transaction {
  id: string;
  transaction_number: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number | null;
  discount_amount: number | null;
  payment_method: string;
  payment_status: string;
  customer_name: string | null;
  created_at: string;
  items: unknown;
}

export function ShiftManager() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [isStartShiftOpen, setIsStartShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [openingCash, setOpeningCash] = useState('0.00');
  const [closingCash, setClosingCash] = useState('0.00');
  const [cashierName, setCashierName] = useState('');
  const [terminalId, setTerminalId] = useState('Terminal-1');

  // Validation helpers
  const openingCashValue = parseFloat(openingCash) || 0;
  const closingCashValue = parseFloat(closingCash) || 0;
  const isOpeningCashValid = openingCashValue >= 0 && !isNaN(openingCashValue);
  const isClosingCashValid = closingCashValue >= 0 && !isNaN(closingCashValue);

  const handleOpeningCashChange = (value: string) => {
    // Allow empty string for typing, but validate on blur/submit
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      setOpeningCash(value);
    }
  };

  const handleClosingCashChange = (value: string) => {
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      setClosingCash(value);
    }
  };

  // Enable real-time updates for shifts and transactions
  useRealtimeShifts(tenantId);

  // Get active shift
  const { data: activeShift, isLoading } = useQuery({
    queryKey: queryKeys.pos.shifts.active(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('pos_shifts')
        .select('id, shift_number, terminal_id, cashier_name, started_at, ended_at, opening_cash, closing_cash, expected_cash, cash_difference, total_sales, total_transactions, cash_sales, card_sales, other_sales, refunds_amount, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Shift | null;
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Backup polling every 30s
  });

  // Enable real-time updates for active shift transactions and cash drawer
  useRealtimeTransactions(tenantId, activeShift?.id);
  useRealtimeCashDrawer(activeShift?.id);

  // Get transactions for the active shift
  const { data: shiftTransactions } = useQuery({
    queryKey: queryKeys.pos.shifts.transactions(activeShift?.id),
    queryFn: async () => {
      if (!activeShift?.id) return [];

      const { data, error } = await supabase
        .from('pos_transactions')
        .select('id, transaction_number, total_amount, subtotal, tax_amount, discount_amount, payment_method, payment_status, customer_name, created_at, items')
        .eq('shift_id', activeShift.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!activeShift?.id && !!tenantId,
    refetchInterval: 30000,
  });

  // Get recent closed shifts
  const { data: recentShifts } = useQuery({
    queryKey: queryKeys.pos.shifts.recent(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('pos_shifts')
        .select('id, shift_number, terminal_id, cashier_name, started_at, ended_at, opening_cash, closing_cash, expected_cash, cash_difference, total_sales, total_transactions, cash_sales, card_sales, other_sales, refunds_amount, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'closed')
        .order('ended_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!tenantId,
  });

  // Calculate shift summary from transactions
  const shiftSummary = useMemo(() => {
    if (!shiftTransactions || shiftTransactions.length === 0) {
      return {
        transactionCount: 0,
        cashTransactions: 0,
        cardTransactions: 0,
        avgTransactionValue: 0,
        refundCount: 0,
        refundTotal: 0,
      };
    }

    const cashTxns = shiftTransactions.filter(t => t.payment_method === 'cash');
    const cardTxns = shiftTransactions.filter(t => t.payment_method === 'card');
    const totalValue = shiftTransactions.reduce((sum, t) => sum + t.total_amount, 0);

    const refundTxns = shiftTransactions.filter(
      t => t.payment_status === 'refunded' || t.total_amount < 0
    );
    const refundTotal = refundTxns.reduce((sum, t) => sum + Math.abs(t.total_amount), 0);

    return {
      transactionCount: shiftTransactions.length,
      cashTransactions: cashTxns.length,
      cardTransactions: cardTxns.length,
      avgTransactionValue: shiftTransactions.length > 0 ? totalValue / shiftTransactions.length : 0,
      refundCount: refundTxns.length,
      refundTotal,
    };
  }, [shiftTransactions]);

  // Start shift mutation
  const startShiftMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');

      const openingAmount = parseFloat(openingCash) || 0;
      if (openingAmount < 0) {
        throw new Error('Opening cash amount must be greater than or equal to 0');
      }

      // Generate shift number: SHIFT-YYYYMMDD-HHMMSS
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const shiftNumber = `SHIFT-${dateStr}-${timeStr}`;

      interface PosShiftInsert {
        tenant_id: string;
        terminal_id: string;
        cashier_id: string;
        cashier_name: string;
        opening_cash: number;
        status: 'open' | 'closed';
        shift_number: string;
      }

      const { data, error } = await supabase
        .from('pos_shifts')
        .insert([{
          tenant_id: tenantId,
          terminal_id: terminalId,
          cashier_id: (await supabase.auth.getUser()).data.user?.id ?? '',
          cashier_name: cashierName,
          opening_cash: openingAmount,
          status: 'open',
          shift_number: shiftNumber,
        }] as PosShiftInsert[])
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.active(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.recent(tenantId) });
      toast.success('Shift started: Your POS shift has been opened.');
      setIsStartShiftOpen(false);
      setCashierName('');
      setOpeningCash('0.00');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to start shift'));
    },
  });

  // Close shift mutation
  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !activeShift) throw new Error('No active shift');

      const closingAmount = parseFloat(closingCash) || 0;
      if (closingAmount < 0) {
        throw new Error('Closing cash amount must be greater than or equal to 0');
      }

      // Account for cash refunds when calculating expected cash
      const cashRefunds = (shiftTransactions ?? [])
        .filter(t => (t.payment_status === 'refunded' || t.total_amount < 0) && t.payment_method === 'cash')
        .reduce((sum, t) => sum + Math.abs(t.total_amount), 0);
      const expectedCash = activeShift.opening_cash + activeShift.cash_sales - cashRefunds;
      const difference = closingAmount - expectedCash;

      const { data, error } = await supabase
        .from('pos_shifts')
        .update({
          status: 'closed',
          ended_at: new Date().toISOString(),
          closing_cash: closingAmount,
          expected_cash: expectedCash,
          cash_difference: difference,
          refunds_amount: shiftSummary.refundTotal,
        })
        .eq('id', activeShift.id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.active(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.recent(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.transactions(activeShift?.id) });
      toast.success('Shift closed: Your POS shift has been closed successfully.');
      setIsCloseShiftOpen(false);
      setClosingCash('0.00');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to close shift'));
    },
  });

  // Handler to view Z-Report for a shift
  const handleViewZReport = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setIsZReportOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading shift information...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Active Shift Card */}
      {activeShift ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle>Active Shift: {activeShift.shift_number}</CardTitle>
                  <CardDescription>
                    Started {new Date(activeShift.started_at).toLocaleString()}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Live
                </Badge>
              </div>
              <Button onClick={() => setIsCloseShiftOpen(true)} variant="destructive">
                Close Shift
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cashier</p>
                <p className="font-semibold">{activeShift.cashier_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Terminal</p>
                <p className="font-semibold">{activeShift.terminal_id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Opening Cash</p>
                <p className="font-semibold">${activeShift.opening_cash.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="font-semibold">{activeShift.total_transactions}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Sales</p>
                      <p className="text-2xl font-bold">${activeShift.total_sales.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Cash Sales</p>
                      <p className="text-2xl font-bold">${activeShift.cash_sales.toFixed(2)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Card Sales</p>
                      <p className="text-2xl font-bold">${activeShift.card_sales.toFixed(2)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Refund Summary */}
            {shiftSummary.refundCount > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Card className="border-red-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Refunds ({shiftSummary.refundCount})</p>
                        <p className="text-2xl font-bold text-red-600">-${shiftSummary.refundTotal.toFixed(2)}</p>
                      </div>
                      <RotateCcw className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Net Sales</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${(activeShift.total_sales - shiftSummary.refundTotal).toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Expected Cash Calculation */}
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Expected Cash</p>
                  <p className="font-semibold text-lg">
                    ${(activeShift.opening_cash + activeShift.cash_sales).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Avg Transaction</p>
                  <p className="font-semibold text-lg">
                    ${shiftSummary.avgTransactionValue.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cash Txns</p>
                  <p className="font-semibold text-lg">{shiftSummary.cashTransactions}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Card Txns</p>
                  <p className="font-semibold text-lg">{shiftSummary.cardTransactions}</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions Summary */}
            {shiftTransactions && shiftTransactions.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Recent Transactions
                  </h4>
                  <span className="text-sm text-muted-foreground">
                    {shiftTransactions.length} total
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {shiftTransactions.slice(0, 5).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                    >
                      <div>
                        <span className="font-medium">{transaction.transaction_number}</span>
                        <span className="text-muted-foreground ml-2">
                          {formatSmartDate(transaction.created_at, { includeTime: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {transaction.payment_method}
                        </Badge>
                        <span className="font-semibold">${transaction.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Active Shift</CardTitle>
            <CardDescription>Start a new shift to begin processing transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsStartShiftOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Start Shift
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Shifts */}
      {recentShifts && recentShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Closed Shifts</CardTitle>
            <CardDescription>View shift summaries and end-of-day reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentShifts.map((shift) => {
                const variance = shift.cash_difference ?? 0;
                const hasVariance = Math.abs(variance) > 0.01;
                return (
                  <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{shift.shift_number}</p>
                        {hasVariance && (
                          <Badge
                            variant={variance >= 0 ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {variance >= 0 ? '+' : ''}${variance.toFixed(2)} variance
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {shift.cashier_name} • {formatSmartDate(shift.ended_at!)}
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="font-semibold">${shift.total_sales.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{shift.total_transactions} transactions</p>
                      {(shift.refunds_amount ?? 0) > 0 && (
                        <p className="text-sm text-red-600">
                          Refunds: -${(shift.refunds_amount ?? 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewZReport(shift.id)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Z-Report
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Shift Dialog */}
      <Dialog open={isStartShiftOpen} onOpenChange={setIsStartShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Shift</DialogTitle>
            <DialogDescription>Enter shift details to begin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cashier-name">Cashier Name</Label>
              <Input
                id="cashier-name"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div>
              <Label htmlFor="terminal-id">Terminal ID</Label>
              <Input
                id="terminal-id"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                placeholder="Terminal-1"
              />
            </div>
            <div>
              <Label htmlFor="opening-cash">Opening Cash Amount</Label>
              <Input
                id="opening-cash"
                type="number"
                step="0.01"
                min="0"
                value={openingCash}
                onChange={(e) => handleOpeningCashChange(e.target.value)}
                placeholder="0.00"
                className={!isOpeningCashValid && openingCash !== '' ? 'border-red-500' : ''}
              />
              {!isOpeningCashValid && openingCash !== '' && (
                <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Cash amount must be 0 or greater
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStartShiftOpen(false)}
              disabled={startShiftMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => startShiftMutation.mutate()}
              disabled={!cashierName || !isOpeningCashValid || startShiftMutation.isPending}
            >
              {startShiftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
              {startShiftMutation.isPending ? 'Starting...' : 'Start Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Shift</DialogTitle>
            <DialogDescription>Count your cash drawer to close the shift</DialogDescription>
          </DialogHeader>
          {activeShift && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Gross Sales</p>
                  <p className="font-semibold">${activeShift.total_sales.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Refunds ({shiftSummary.refundCount})</p>
                  <p className="font-semibold text-red-600">-${shiftSummary.refundTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Sales</p>
                  <p className="font-semibold text-green-600">${(activeShift.total_sales - shiftSummary.refundTotal).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Cash</p>
                  <p className="font-semibold">
                    ${(activeShift.opening_cash + activeShift.cash_sales).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                <div>
                  <p className="text-muted-foreground">Opening Cash</p>
                  <p className="font-medium">${activeShift.opening_cash.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">+ Cash Sales</p>
                  <p className="font-medium">${activeShift.cash_sales.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">+ Card Sales</p>
                  <p className="font-medium">${activeShift.card_sales.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="font-medium">{activeShift.total_transactions}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="closing-cash">Actual Cash Count</Label>
                <Input
                  id="closing-cash"
                  type="number"
                  step="0.01"
                  min="0"
                  value={closingCash}
                  onChange={(e) => handleClosingCashChange(e.target.value)}
                  placeholder="0.00"
                  className={!isClosingCashValid && closingCash !== '' ? 'border-red-500' : ''}
                />
                {!isClosingCashValid && closingCash !== '' && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Cash amount must be 0 or greater
                  </p>
                )}
                {isClosingCashValid && closingCash && (
                  <div className="mt-2 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">
                      Variance:{' '}
                      <span
                        className={
                          closingCashValue - (activeShift.opening_cash + activeShift.cash_sales) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {closingCashValue - (activeShift.opening_cash + activeShift.cash_sales) >= 0 ? '+' : ''}
                        ${(closingCashValue - (activeShift.opening_cash + activeShift.cash_sales)).toFixed(2)}
                      </span>
                    </p>
                    {Math.abs(closingCashValue - (activeShift.opening_cash + activeShift.cash_sales)) > 10 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Large variance detected. Please verify count.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCloseShiftOpen(false)}
              disabled={closeShiftMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => closeShiftMutation.mutate()}
              disabled={!isClosingCashValid || closingCash === '' || closeShiftMutation.isPending}
              variant="destructive"
            >
              {closeShiftMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {closeShiftMutation.isPending ? 'Closing...' : 'Close Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Z-Report Dialog */}
      <Dialog open={isZReportOpen} onOpenChange={setIsZReportOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>End of Day Report</DialogTitle>
            <DialogDescription>
              Complete shift summary and transaction details
            </DialogDescription>
          </DialogHeader>
          {selectedShiftId && <ZReport shiftId={selectedShiftId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
