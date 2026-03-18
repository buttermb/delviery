import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { toast } from 'sonner';
import { useRecordPayment } from '@/hooks/useRecordPayment';
import type { PaymentMethod } from '@/lib/services/paymentService';
import { formatCurrency } from '@/lib/formatters';

export default function RecordFrontedPayment() {
  const _navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { id } = useParams<{ id: string }>();
  const { tenant } = useTenantAdminAuth();
  const { recordFrontedPayment, isRecordingFrontedPayment } = useRecordPayment();
  
  const [frontedItem, setFrontedItem] = useState<{
    id: string;
    expected_revenue: number | null;
    payment_received: number | null;
    product?: { name: string | null } | null;
    client?: { id: string; business_name: string; outstanding_balance: number } | null;
    [key: string]: unknown;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadFrontedItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFrontedItem is defined below, only run when id changes
  }, [id]);

  const loadFrontedItem = async () => {
    if (!tenant?.id) return;
    try {
      const { data } = await supabase
        .from('fronted_inventory')
        .select('*, product:products(name), client:wholesale_clients(id, business_name, outstanding_balance)')
        .eq('id', id)
        .eq('account_id', tenant.id)
        .maybeSingle();

      setFrontedItem(data);
      const amountOwed = (data?.expected_revenue ?? 0) - (data?.payment_received ?? 0);
      setAmount(amountOwed.toFixed(2));
    } catch (error) {
      logger.error('Error loading fronted item:', error);
    }
  };

  const handleRecordPayment = async () => {
    if (!tenant?.id || !id) {
      toast.error("Tenant or fronted inventory ID not found");
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      const _result = await recordFrontedPayment({
        frontedId: id,
        amount: paymentAmount,
        paymentMethod,
        notes: notes || undefined,
        reference: reference || undefined,
        showToast: false // We handle toast manually for custom message
      });

      toast.success("Payment of ${formatCurrency(paymentAmount)} recorded${result.clientName ? ");

      navigateToAdmin('inventory/fronted');
    } catch (error) {
      logger.error('Error recording payment:', error);
      toast.error("Error");
    }
  };

  if (!frontedItem) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const amountOwed = (frontedItem.expected_revenue ?? 0) - (frontedItem.payment_received ?? 0);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead title="Record Payment | Inventory Management" />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigateToAdmin('fronted-inventory')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Record Payment</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Expected:</span>
                <span className="font-bold">{formatCurrency(frontedItem.expected_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-bold">{formatCurrency(frontedItem.payment_received)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2">
                <span className="font-bold">Amount Owed:</span>
                <span className="font-bold text-red-600">{formatCurrency(amountOwed)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Payment Amount *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <Button
                  variant="outline"
                  onClick={() => setAmount(amountOwed.toFixed(2))}
                >
                  Full Amount
                </Button>
              </div>
            </div>

            <div>
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference Number (Optional)</Label>
              <Input
                placeholder="Check #, Venmo ID, etc."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleRecordPayment}
          disabled={isRecordingFrontedPayment}
          className="w-full"
          size="lg"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          {isRecordingFrontedPayment ? 'Recording...' : 'Record Payment'}
        </Button>
      </div>
    </div>
  );
}
