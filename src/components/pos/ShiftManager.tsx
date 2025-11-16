import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Clock, Users, TrendingUp } from 'lucide-react';
import { useRealtimeShifts, useRealtimeTransactions, useRealtimeCashDrawer } from '@/hooks/useRealtimePOS';

interface Shift {
  id: string;
  shift_number: string;
  terminal_id: string;
  cashier_name: string;
  started_at: string;
  ended_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  total_sales: number;
  total_transactions: number;
  cash_sales: number;
  card_sales: number;
  status: 'open' | 'closed';
}

export function ShiftManager() {
  const { tenant } = useTenantAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [isStartShiftOpen, setIsStartShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState('0.00');
  const [closingCash, setClosingCash] = useState('0.00');
  const [cashierName, setCashierName] = useState('');
  const [terminalId, setTerminalId] = useState('Terminal-1');

  // Enable real-time updates for shifts and transactions
  useRealtimeShifts(tenantId);

  // Get active shift
  const { data: activeShift, isLoading } = useQuery({
    queryKey: ['active-shift', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('pos_shifts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Shift | null;
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Backup polling every 30s
  });

  // Enable real-time updates for active shift transactions and cash drawer
  useRealtimeTransactions(tenantId, activeShift?.id);
  useRealtimeCashDrawer(activeShift?.id);

  // Get recent closed shifts
  const { data: recentShifts } = useQuery({
    queryKey: ['recent-shifts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('pos_shifts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'closed')
        .order('ended_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!tenantId,
  });

  // Start shift mutation
  const startShiftMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');

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
          cashier_id: (await supabase.auth.getUser()).data.user?.id || '',
          cashier_name: cashierName,
          opening_cash: parseFloat(openingCash),
          status: 'open',
          shift_number: shiftNumber,
        }] as PosShiftInsert[])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
      toast({ title: 'Shift started', description: 'Your POS shift has been opened.' });
      setIsStartShiftOpen(false);
      setCashierName('');
      setOpeningCash('0.00');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Close shift mutation
  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !activeShift) throw new Error('No active shift');

      const closingAmount = parseFloat(closingCash);
      const expectedCash = activeShift.opening_cash + activeShift.cash_sales;
      const difference = closingAmount - expectedCash;

      const { data, error } = await supabase
        .from('pos_shifts')
        .update({
          status: 'closed',
          ended_at: new Date().toISOString(),
          closing_cash: closingAmount,
          expected_cash: expectedCash,
          cash_difference: difference,
        })
        .eq('id', activeShift.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['recent-shifts', tenantId] });
      toast({ title: 'Shift closed', description: 'Your POS shift has been closed successfully.' });
      setIsCloseShiftOpen(false);
      setClosingCash('0.00');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

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
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">{shift.shift_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {shift.cashier_name} • {new Date(shift.ended_at!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${shift.total_sales.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{shift.total_transactions} transactions</p>
                  </div>
                </div>
              ))}
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
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStartShiftOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => startShiftMutation.mutate()}
              disabled={!cashierName || startShiftMutation.isPending}
            >
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
                  <p className="text-sm text-muted-foreground">Expected Cash</p>
                  <p className="font-semibold">
                    ${(activeShift.opening_cash + activeShift.cash_sales).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="font-semibold">${activeShift.total_sales.toFixed(2)}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="closing-cash">Actual Cash Count</Label>
                <Input
                  id="closing-cash"
                  type="number"
                  step="0.01"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                />
                {closingCash && (
                  <p className="text-sm mt-2">
                    Difference:{' '}
                    <span
                      className={
                        parseFloat(closingCash) - (activeShift.opening_cash + activeShift.cash_sales) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      ${(parseFloat(closingCash) - (activeShift.opening_cash + activeShift.cash_sales)).toFixed(2)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseShiftOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => closeShiftMutation.mutate()}
              disabled={!closingCash || closeShiftMutation.isPending}
              variant="destructive"
            >
              {closeShiftMutation.isPending ? 'Closing...' : 'Close Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
