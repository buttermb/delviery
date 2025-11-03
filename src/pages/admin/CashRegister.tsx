import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { DollarSign, Clock, Receipt, Lock, Unlock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CashShift {
  id: string;
  register_id?: string;
  opened_at: string;
  closed_at?: string;
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  difference?: number;
  status: 'open' | 'closed';
  opened_by?: string;
  closed_by?: string;
}

interface CashTransaction {
  id: string;
  shift_id: string;
  type: 'sale' | 'refund' | 'drop' | 'deposit';
  amount: number;
  description: string;
  created_at: string;
}

export default function CashRegister() {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [cashDrop, setCashDrop] = useState('');

  const { data: currentShift, isLoading: shiftLoading } = useQuery({
    queryKey: ['cash-shift', tenantId],
    queryFn: async (): Promise<CashShift | null> => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('cash_shifts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code === '42P01') {
          return null; // Table doesn't exist
        }
        if (error && error.code === 'PGRST116') {
          return null; // No open shift
        }
        if (error) throw error;
        return data;
      } catch (error: any) {
        if (error.code === '42P01' || error.code === 'PGRST116') return null;
        throw error;
      }
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: transactions } = useQuery({
    queryKey: ['cash-transactions', currentShift?.id],
    queryFn: async (): Promise<CashTransaction[]> => {
      if (!currentShift?.id) return [];

      try {
        const { data, error } = await supabase
          .from('cash_transactions')
          .select('*')
          .eq('shift_id', currentShift.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!currentShift?.id,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const openShiftMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!tenantId || !admin) throw new Error('Tenant ID and admin required');

      const { data, error } = await supabase
        .from('cash_shifts')
        .insert({
          tenant_id: tenantId,
          opening_amount: amount,
          status: 'open',
          opened_by: admin.id,
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Cash shifts table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-shift', tenantId] });
      toast({ title: 'Shift opened', description: 'Cash register shift has been opened.' });
      setShowOpenForm(false);
      setOpeningAmount('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open shift',
        variant: 'destructive',
      });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async ({ closingAmount, expectedAmount }: { closingAmount: number; expectedAmount: number }) => {
      if (!currentShift || !admin) throw new Error('Shift and admin required');

      const difference = closingAmount - expectedAmount;

      const { data, error } = await supabase
        .from('cash_shifts')
        .update({
          closing_amount: closingAmount,
          expected_amount: expectedAmount,
          difference,
          status: 'closed',
          closed_by: admin.id,
          closed_at: new Date().toISOString(),
        })
        .eq('id', currentShift.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-shift', tenantId] });
      toast({ title: 'Shift closed', description: 'Cash register shift has been closed.' });
      setShowCloseForm(false);
      setClosingAmount('');
      setCashDrop('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to close shift',
        variant: 'destructive',
      });
    },
  });

  const recordCashDropMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!currentShift) throw new Error('No open shift');

      const { data, error } = await supabase
        .from('cash_transactions')
        .insert({
          shift_id: currentShift.id,
          type: 'drop',
          amount,
          description: `Cash drop - $${amount.toFixed(2)}`,
        })
        .select()
        .single();

      if (error && error.code === '42P01') {
        throw new Error('Cash transactions table does not exist.');
      }
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-transactions', currentShift?.id] });
      queryClient.invalidateQueries({ queryKey: ['cash-shift', tenantId] });
      toast({ title: 'Cash drop recorded', description: 'Cash drop has been recorded.' });
      setCashDrop('');
    },
  });

  // Calculate totals
  const salesTotal = transactions?.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0) || 0;
  const refundsTotal = transactions?.filter((t) => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0) || 0;
  const dropsTotal = transactions?.filter((t) => t.type === 'drop').reduce((sum, t) => sum + t.amount, 0) || 0;
  const expectedAmount = currentShift
    ? Number(currentShift.opening_amount) + salesTotal - refundsTotal - dropsTotal
    : 0;

  if (shiftLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading cash register...</div>
      </div>
    );
  }

  const isOpen = currentShift?.status === 'open';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cash Register</h1>
          <p className="text-muted-foreground">Manage cash register shifts and transactions</p>
        </div>
        {!isOpen && (
          <Button onClick={() => setShowOpenForm(true)}>
            <Unlock className="h-4 w-4 mr-2" />
            Open Shift
          </Button>
        )}
        {isOpen && (
          <Button variant="destructive" onClick={() => setShowCloseForm(true)}>
            <Lock className="h-4 w-4 mr-2" />
            Close Shift
          </Button>
        )}
      </div>

      {/* Shift Status Card */}
      <Card className={isOpen ? 'border-green-500' : 'border-gray-300'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOpen ? <Unlock className="h-5 w-5 text-green-500" /> : <Lock className="h-5 w-5" />}
            Shift Status: {isOpen ? 'OPEN' : 'CLOSED'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isOpen && currentShift ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Opening Amount</div>
                <div className="text-xl font-bold">${Number(currentShift.opening_amount).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sales</div>
                <div className="text-xl font-bold text-green-600">${salesTotal.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Refunds</div>
                <div className="text-xl font-bold text-red-600">-${refundsTotal.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Expected Amount</div>
                <div className="text-xl font-bold">${expectedAmount.toFixed(2)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-muted-foreground">Opened At</div>
                <div className="font-medium">{new Date(currentShift.opened_at).toLocaleString()}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-muted-foreground">Opened By</div>
                <div className="font-medium">{admin?.name || 'Admin'}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No open shift. Open a new shift to begin recording transactions.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Shift Form */}
      {showOpenForm && (
        <Card>
          <CardHeader>
            <CardTitle>Open Cash Register Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="opening-amount">Opening Cash Amount</Label>
                <Input
                  id="opening-amount"
                  type="number"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const amount = Number(openingAmount);
                    if (isNaN(amount) || amount < 0) {
                      toast({
                        title: 'Invalid amount',
                        description: 'Please enter a valid amount.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    openShiftMutation.mutate(amount);
                  }}
                  disabled={openShiftMutation.isPending}
                >
                  Open Shift
                </Button>
                <Button variant="outline" onClick={() => setShowOpenForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close Shift Form */}
      {showCloseForm && currentShift && (
        <Card>
          <CardHeader>
            <CardTitle>Close Cash Register Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Expected Amount</div>
                <div className="text-2xl font-bold">${expectedAmount.toFixed(2)}</div>
              </div>
              <div>
                <Label htmlFor="closing-amount">Actual Closing Amount</Label>
                <Input
                  id="closing-amount"
                  type="number"
                  step="0.01"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {closingAmount && expectedAmount > 0 && (
                <div className={`p-4 rounded-lg ${Number(closingAmount) - expectedAmount !== 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="text-sm text-muted-foreground">Difference</div>
                  <div className={`text-2xl font-bold ${Number(closingAmount) - expectedAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(closingAmount) - expectedAmount >= 0 ? '+' : ''}
                    ${(Number(closingAmount) - expectedAmount).toFixed(2)}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const closing = Number(closingAmount);
                    if (isNaN(closing) || closing < 0) {
                      toast({
                        title: 'Invalid amount',
                        description: 'Please enter a valid closing amount.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    closeShiftMutation.mutate({ closingAmount: closing, expectedAmount });
                  }}
                  disabled={closeShiftMutation.isPending}
                >
                  Close Shift
                </Button>
                <Button variant="outline" onClick={() => setShowCloseForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Drop */}
      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Record Cash Drop</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={cashDrop}
                onChange={(e) => setCashDrop(e.target.value)}
                placeholder="Amount to drop"
              />
              <Button
                onClick={() => {
                  const amount = Number(cashDrop);
                  if (isNaN(amount) || amount <= 0) {
                    toast({
                      title: 'Invalid amount',
                      description: 'Please enter a valid amount.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  recordCashDropMutation.mutate(amount);
                }}
                disabled={recordCashDropMutation.isPending}
              >
                Record Drop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History ({transactions?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.type === 'sale'
                              ? 'default'
                              : transaction.type === 'refund'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        {transaction.type === 'refund' ? '-' : '+'}
                        ${transaction.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {transactions !== undefined
                  ? 'No transactions recorded yet.'
                  : 'Cash transactions table not found.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

