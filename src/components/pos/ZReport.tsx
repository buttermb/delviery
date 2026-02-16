import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeTransactions } from '@/hooks/useRealtimePOS';

interface ZReportProps {
  shiftId: string;
}

export function ZReport({ shiftId }: ZReportProps) {
  const { tenant } = useTenantAdminAuth();
  const { toast } = useToast();
  const tenantId = tenant?.id;

  // Enable real-time updates for this shift's transactions
  useRealtimeTransactions(tenantId, shiftId);

  const { data: shift, isLoading } = useQuery({
    queryKey: ['shift-details', shiftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_shifts')
        .select('*')
        .eq('id', shiftId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!shiftId,
    refetchInterval: 30000, // Backup polling
  });

  const { data: transactions } = useQuery({
    queryKey: ['shift-transactions', shiftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!shiftId,
    refetchInterval: 30000, // Backup polling
  });

  const handlePrint = () => {
    window.print();
    toast({ title: 'Printing Z-Report' });
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

    toast({ title: 'Report downloaded' });
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
Total Sales: $${shift.total_sales.toFixed(2)}
Refunds: $${(shift.refunds_amount || 0).toFixed(2)}

Net Sales: $${(shift.total_sales - (shift.refunds_amount || 0)).toFixed(2)}

========================================
        PAYMENT METHOD BREAKDOWN
========================================

Cash Sales: $${shift.cash_sales.toFixed(2)}
Card Sales: $${shift.card_sales.toFixed(2)}
Other: $${shift.other_sales.toFixed(2)}

========================================
         CASH DRAWER BALANCE
========================================

Opening Cash: $${shift.opening_cash.toFixed(2)}
+ Cash Sales: $${shift.cash_sales.toFixed(2)}
Expected Cash: $${(shift.expected_cash || 0).toFixed(2)}

Closing Cash: $${(shift.closing_cash || 0).toFixed(2)}
Difference: $${(shift.cash_difference || 0).toFixed(2)}

========================================
         TRANSACTION DETAILS
========================================

${transactions?.map((t, i) => `
${i + 1}. ${t.transaction_number}
   Time: ${new Date(t.created_at).toLocaleTimeString()}
   Amount: $${t.total_amount.toFixed(2)}
   Payment: ${t.payment_method}
   Status: ${t.payment_status}
`).join('\n') || 'No transactions'}

========================================
    Generated: ${new Date().toLocaleString()}
========================================
    `;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading Z-Report...</div>;
  }

  if (!shift) {
    return <div className="text-center py-8">Shift not found</div>;
  }

  const netSales = shift.total_sales - (shift.refunds_amount || 0);

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
                <span className="font-semibold">${shift.total_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Refunds</span>
                <span className="font-semibold">-${(shift.refunds_amount || 0).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Net Sales</span>
                <span>${netSales.toFixed(2)}</span>
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
                <span className="font-semibold">${shift.cash_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card</span>
                <span className="font-semibold">${shift.card_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Other</span>
                <span className="font-semibold">${shift.other_sales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Cash Drawer */}
          <div>
            <h3 className="font-semibold mb-4">Cash Drawer Balance</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Opening Cash</span>
                <span className="font-semibold">${shift.opening_cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Cash Sales</span>
                <span className="font-semibold">${shift.cash_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Expected Cash</span>
                <span className="font-semibold">${(shift.expected_cash || 0).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Closing Cash (Counted)</span>
                <span className="font-semibold">${(shift.closing_cash || 0).toFixed(2)}</span>
              </div>
              <div
                className={`flex justify-between font-bold ${
                  (shift.cash_difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <span>Difference</span>
                <span>${(shift.cash_difference || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Transaction List */}
          {transactions && transactions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4">Transaction Details ({transactions.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transactions.map((transaction, index) => (
                  <div key={transaction.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">
                        #{index + 1} - {transaction.transaction_number}
                      </span>
                      <span className="font-semibold">${transaction.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{new Date(transaction.created_at).toLocaleTimeString()}</span>
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
