import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Download } from 'lucide-react';
import { useRealtimeTransactions } from '@/hooks/useRealtimePOS';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';

interface ZReportProps {
  shiftId: string;
}

export function ZReport({ shiftId }: ZReportProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Enable real-time updates for this shift's transactions
  useRealtimeTransactions(tenantId, shiftId);

  const { data: shift, isLoading } = useQuery({
    queryKey: queryKeys.pos.shifts.detail(shiftId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('pos_shifts')
        .select('id, shift_number, terminal_id, cashier_name, started_at, ended_at, opening_cash, closing_cash, expected_cash, cash_difference, total_sales, total_transactions, cash_sales, card_sales, other_sales, refunds_amount, status')
        .eq('id', shiftId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!shiftId && !!tenantId,
    refetchInterval: 30000, // Backup polling
  });

  const { data: transactions } = useQuery({
    queryKey: queryKeys.pos.shifts.transactions(shiftId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('pos_transactions')
        .select('id, transaction_number, total_amount, subtotal, tax_amount, discount_amount, payment_method, payment_status, customer_name, created_at, items')
        .eq('tenant_id', tenantId)
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!shiftId && !!tenantId,
    refetchInterval: 30000, // Backup polling
  });

  const handlePrint = () => {
    window.print();
    toast.success('Printing Z-Report');
  };

  const handleDownload = () => {
    if (!shift) return;

    const reportContent = generateReportText();
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Z-Report-${shift.shift_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Report downloaded');
  };

  const generateReportText = () => {
    if (!shift) return '';

    return `
========================================
        Z-REPORT (END OF DAY)
========================================

Shift Number: ${shift.shift_number}
Terminal: ${shift.terminal_id}
Cashier: ${shift.cashier_name}

Started: ${new Date(shift.started_at).toLocaleString()}
Ended: ${shift.ended_at ? new Date(shift.ended_at).toLocaleString() : 'In Progress'}

========================================
           SALES SUMMARY
========================================

Total Transactions: ${shift.total_transactions}
Total Sales: ${formatCurrency(shift.total_sales)}
Refunds (${refundCount}): -${formatCurrency(totalRefunds)}

Net Sales: ${formatCurrency(netSales)}

========================================
        PAYMENT METHOD BREAKDOWN
========================================

Cash Sales: ${formatCurrency(shift.cash_sales)}
Card Sales: ${formatCurrency(shift.card_sales)}
Other: ${formatCurrency(shift.other_sales)}
${refundCount > 0 ? `
========================================
          REFUND BREAKDOWN
========================================

Refund Count: ${refundCount}
Total Refunds: -${formatCurrency(totalRefunds)}
${cashRefunds > 0 ? `  Cash Refunds: -${formatCurrency(cashRefunds)}\n` : ''}${cardRefunds > 0 ? `  Card Refunds: -${formatCurrency(cardRefunds)}\n` : ''}${otherRefunds > 0 ? `  Other Refunds: -${formatCurrency(otherRefunds)}\n` : ''}
Net Sales: ${formatCurrency(netSales)}` : ''}

========================================
         CASH DRAWER BALANCE
========================================

Opening Cash: ${formatCurrency(shift.opening_cash)}
+ Cash Sales: ${formatCurrency(shift.cash_sales)}
${cashRefunds > 0 ? `- Cash Refunds: -${formatCurrency(cashRefunds)}\n` : ''}Expected Cash: ${formatCurrency(shift.expected_cash ?? 0)}

Closing Cash: ${formatCurrency(shift.closing_cash ?? 0)}
Difference: ${formatCurrency(shift.cash_difference ?? 0)}

========================================
         TRANSACTION DETAILS
========================================

${transactions?.map((t, i) => `
${i + 1}. ${t.transaction_number}
   Time: ${formatSmartDate(t.created_at, { includeTime: true })}
   Amount: ${formatCurrency(t.total_amount)}
   Payment: ${t.payment_method}
   Status: ${t.payment_status}
`).join('\n') || 'No transactions'}

========================================
    Generated: ${formatSmartDate(new Date(), { includeTime: true })}
========================================
    `;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading Z-Report...</div>;
  }

  if (!shift) {
    return <div className="text-center py-8">Shift not found</div>;
  }

  const netSales = shift.total_sales - (shift.refunds_amount ?? 0);

  // Compute refund stats from transactions
  const refundTransactions = transactions?.filter(
    (t) => t.payment_status === 'refunded' || t.total_amount < 0
  ) ?? [];
  const refundCount = refundTransactions.length;
  const totalRefunds = shift.refunds_amount ?? 0;
  const cashRefunds = refundTransactions
    .filter((t) => t.payment_method === 'cash')
    .reduce((sum, t) => sum + Math.abs(t.total_amount), 0);
  const cardRefunds = refundTransactions
    .filter((t) => t.payment_method === 'card')
    .reduce((sum, t) => sum + Math.abs(t.total_amount), 0);
  const otherRefunds = refundTransactions
    .filter((t) => t.payment_method !== 'cash' && t.payment_method !== 'card')
    .reduce((sum, t) => sum + Math.abs(t.total_amount), 0);

  return (
    <div className="space-y-6 print:p-8">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold">Z-Report (End of Day)</h2>
          <p className="text-muted-foreground">Shift {shift.shift_number}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <Card>
        <CardHeader>
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl">Z-REPORT</CardTitle>
            <CardDescription>End of Day Summary</CardDescription>
            <Separator className="my-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shift Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Terminal</p>
              <p className="font-semibold">{shift.terminal_id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cashier</p>
              <p className="font-semibold">{shift.cashier_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="font-semibold">{new Date(shift.started_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ended</p>
              <p className="font-semibold">
                {shift.ended_at ? new Date(shift.ended_at).toLocaleString() : 'In Progress'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Sales Summary */}
          <div>
            <h3 className="font-semibold mb-4">Sales Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Transactions</span>
                <span className="font-semibold">{shift.total_transactions}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Sales</span>
                <span className="font-semibold">{formatCurrency(shift.total_sales)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Refunds ({refundCount})</span>
                <span className="font-semibold">-{formatCurrency(totalRefunds)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Net Sales</span>
                <span>{formatCurrency(netSales)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Breakdown */}
          <div>
            <h3 className="font-semibold mb-4">Payment Method Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Cash</span>
                <span className="font-semibold">{formatCurrency(shift.cash_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card</span>
                <span className="font-semibold">{formatCurrency(shift.card_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Other</span>
                <span className="font-semibold">{formatCurrency(shift.other_sales)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Refund Breakdown */}
          {refundCount > 0 && (
            <>
              <div>
                <h3 className="font-semibold mb-4">Refund Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Refund Count</span>
                    <span className="font-semibold">{refundCount}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Total Refunds</span>
                    <span className="font-semibold">-{formatCurrency(totalRefunds)}</span>
                  </div>
                  {cashRefunds > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span className="pl-4">Cash Refunds</span>
                      <span>-{formatCurrency(cashRefunds)}</span>
                    </div>
                  )}
                  {cardRefunds > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span className="pl-4">Card Refunds</span>
                      <span>-{formatCurrency(cardRefunds)}</span>
                    </div>
                  )}
                  {otherRefunds > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span className="pl-4">Other Refunds</span>
                      <span>-{formatCurrency(otherRefunds)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Net Sales</span>
                    <span>{formatCurrency(netSales)}</span>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Cash Drawer */}
          <div>
            <h3 className="font-semibold mb-4">Cash Drawer Balance</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Opening Cash</span>
                <span className="font-semibold">{formatCurrency(shift.opening_cash)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Cash Sales</span>
                <span className="font-semibold">{formatCurrency(shift.cash_sales)}</span>
              </div>
              {cashRefunds > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>- Cash Refunds</span>
                  <span className="font-semibold">-{formatCurrency(cashRefunds)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Expected Cash</span>
                <span className="font-semibold">{formatCurrency(shift.expected_cash ?? 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Closing Cash (Counted)</span>
                <span className="font-semibold">{formatCurrency(shift.closing_cash ?? 0)}</span>
              </div>
              <div
                className={`flex justify-between font-bold ${
                  (shift.cash_difference ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <span>Difference</span>
                <span>{formatCurrency(shift.cash_difference ?? 0)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Transaction List */}
          {transactions && transactions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4">Transaction Details ({transactions.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
                {transactions.map((transaction, index) => (
                  <div key={transaction.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">
                        #{index + 1} - {transaction.transaction_number}
                      </span>
                      <span className="font-semibold">{formatCurrency(transaction.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{formatSmartDate(transaction.created_at, { includeTime: true })}</span>
                      <span>
                        {transaction.payment_method} • {transaction.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="text-center text-sm text-muted-foreground">
            <p>Report generated: {new Date().toLocaleString()}</p>
            <p className="mt-2">Shift Number: {shift.shift_number}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
