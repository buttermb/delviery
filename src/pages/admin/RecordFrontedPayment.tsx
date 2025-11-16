import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
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
import { useToast } from '@/hooks/use-toast';

export default function RecordFrontedPayment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { account, userProfile } = useAccount();
  const { toast } = useToast();
  const [frontedItem, setFrontedItem] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFrontedItem();
  }, [id]);

  const loadFrontedItem = async () => {
    try {
      // @ts-ignore
      const { data } = await supabase
        .from('fronted_inventory')
        .select('*, product:products(name)')
        .eq('id', id)
        .single();
      
      setFrontedItem(data);
      const amountOwed = (data?.expected_revenue || 0) - (data?.payment_received || 0);
      setAmount(amountOwed.toFixed(2));
    } catch (error) {
      console.error('Error loading fronted item:', error);
    }
  };

  const handleRecordPayment = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid payment amount',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create payment record
      await supabase.from('fronted_payments').insert({
        account_id: account?.id,
        fronted_inventory_id: id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_reference: reference || null,
        received_by: userProfile?.id,
        notes
      });

      // Update fronted inventory payment status
      const newTotalReceived = (frontedItem.payment_received || 0) + paymentAmount;
      const expectedRevenue = frontedItem.expected_revenue || 0;
      
      let newPaymentStatus = 'pending';
      if (newTotalReceived >= expectedRevenue) {
        newPaymentStatus = 'paid';
      } else if (newTotalReceived > 0) {
        newPaymentStatus = 'partial';
      }

      await supabase
        .from('fronted_inventory')
        .update({
          payment_received: newTotalReceived,
          payment_status: newPaymentStatus,
          status: newPaymentStatus === 'paid' ? 'completed' : 'active',
          completed_at: newPaymentStatus === 'paid' ? new Date().toISOString() : null,
          completed_by: newPaymentStatus === 'paid' ? userProfile?.id : null
        })
        .eq('id', id);

      toast({
        title: 'Success!',
        description: `Payment of $${paymentAmount.toFixed(2)} recorded`
      });
      
      navigate('/admin/inventory/fronted');
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to record payment',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!frontedItem) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const amountOwed = (frontedItem.expected_revenue || 0) - (frontedItem.payment_received || 0);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Record Payment | Inventory Management" />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">💳 Record Payment</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Expected:</span>
                <span className="font-bold">${frontedItem.expected_revenue?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-bold">${frontedItem.payment_received?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2">
                <span className="font-bold">Amount Owed:</span>
                <span className="font-bold text-red-600">${amountOwed.toFixed(2)}</span>
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
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
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
          disabled={loading}
          className="w-full"
          size="lg"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          {loading ? 'Recording...' : 'Record Payment'}
        </Button>
      </div>
    </div>
  );
}
