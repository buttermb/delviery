/**
 * 📦 BIG PLUG CRM - Enhanced Order Workflow
 * Multi-step order creation with credit checks, runner assignment, collection tracking
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, 
  Package, DollarSign, Truck, FileText, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { format } from 'date-fns';

type OrderStep = 'client' | 'products' | 'payment' | 'delivery' | 'notes' | 'review';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity_lbs: number;
  unit_price: number;
  available_lbs?: number;
}

export function BigPlugOrderWorkflow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account } = useAccount();
  const queryClient = useQueryClient();

  const clientIdParam = searchParams.get('client');

  const [currentStep, setCurrentStep] = useState<OrderStep>('client');
  const [selectedClientId, setSelectedClientId] = useState(clientIdParam || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'partial'>('credit');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'runner' | 'pickup'>('runner');
  const [selectedRunnerId, setSelectedRunnerId] = useState('');
  const [pickupWarehouse, setPickupWarehouse] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [collectOldBalance, setCollectOldBalance] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [runnerNotes, setRunnerNotes] = useState('');

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['big-plug-clients-select', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const { data } = await supabase
        .from('wholesale_clients')
        .select('*')
        .eq('account_id', account.id)
        .eq('status', 'active')
        .order('business_name');
      return data || [];
    },
    enabled: !!account?.id,
  });

  // Fetch inventory
  const { data: inventory } = useQuery({
    queryKey: ['big-plug-inventory-select', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const { data } = await supabase
        .from('wholesale_inventory')
        .select('*')
        .eq('account_id', account.id)
        .gt('quantity_lbs', 0)
        .order('product_name');
      return data || [];
    },
    enabled: !!account?.id,
  });

  // Fetch runners
  const { data: runners } = useQuery({
    queryKey: ['big-plug-runners', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const { data } = await supabase
        .from('wholesale_runners')
        .select('*')
        .eq('account_id', account.id)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!account?.id,
  });

  const selectedClient = clients?.find(c => c.id === selectedClientId);
  
  // Credit calculations
  const availableCredit = selectedClient 
    ? Number(selectedClient.credit_limit || 0) - Number(selectedClient.outstanding_balance || 0)
    : 0;

  const totals = orderItems.reduce((acc, item) => {
    const subtotal = item.quantity_lbs * item.unit_price;
    acc.total += subtotal;
    acc.totalLbs += item.quantity_lbs;
    return acc;
  }, { total: 0, totalLbs: 0 });

  const cost = totals.total * 0.64; // 64% cost basis
  const profit = totals.total - cost;
  const margin = totals.total > 0 ? (profit / totals.total) * 100 : 0;

  // Credit check
  const newBalance = paymentMethod === 'credit' 
    ? Number(selectedClient?.outstanding_balance || 0) + totals.total
    : Number(selectedClient?.outstanding_balance || 0);

  const overCreditLimit = newBalance > Number(selectedClient?.credit_limit || 0);
  const creditWarnings: string[] = [];

  if (selectedClient) {
    const daysOverdue = selectedClient.last_payment_date
      ? Math.floor((Date.now() - new Date(selectedClient.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysOverdue > 7) {
      creditWarnings.push(`Client is ${daysOverdue} days overdue on payments`);
    }

    if (overCreditLimit) {
      creditWarnings.push(`Order would exceed credit limit by $${(newBalance - Number(selectedClient.credit_limit)).toLocaleString()}`);
    }

    if (Number(selectedClient.outstanding_balance) > 0 && !collectOldBalance) {
      creditWarnings.push(`Client has $${Number(selectedClient.outstanding_balance).toLocaleString()} outstanding`);
    }
  }

  const steps: { key: OrderStep; label: string }[] = [
    { key: 'client', label: 'Client' },
    { key: 'products', label: 'Products' },
    { key: 'payment', label: 'Payment' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'notes', label: 'Notes' },
    { key: 'review', label: 'Review' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!account?.id || !selectedClientId || orderItems.length === 0) {
        throw new Error('Missing required fields');
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;

      // Calculate payment due date
      let dueDate: string | null = null;
      if (paymentMethod === 'credit' || paymentMethod === 'partial') {
        const terms = selectedClient?.payment_terms || 7;
        const due = new Date();
        due.setDate(due.getDate() + terms);
        dueDate = due.toISOString();
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('wholesale_orders')
        .insert({
          account_id: account.id,
          order_number: orderNumber,
          client_id: selectedClientId,
          status: 'pending',
          total_amount: totals.total,
          delivery_address: selectedClient?.address || '',
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash' ? 'paid' : 'unpaid',
          payment_due_date: dueDate,
          delivery_method: deliveryMethod,
          delivery_notes: runnerNotes,
          internal_notes: internalNotes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const items = orderItems.map(item => ({
        order_id: order.id,
        product_name: item.product_name,
        quantity: item.quantity_lbs,
        unit_price: item.unit_price,
        subtotal: item.quantity_lbs * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('wholesale_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Update client balance if credit
      if (paymentMethod === 'credit' || paymentMethod === 'partial') {
        const newBalance = Number(selectedClient?.outstanding_balance || 0) + totals.total;
        const { error: updateError } = await supabase
          .from('wholesale_clients')
          .update({ outstanding_balance: newBalance })
          .eq('id', selectedClientId);

        if (updateError) throw updateError;
      }

      // Create delivery if runner
      if (deliveryMethod === 'runner' && selectedRunnerId) {
        const { error: deliveryError } = await supabase
          .from('wholesale_deliveries')
          .insert({
            account_id: account.id,
            order_id: order.id,
            runner_id: selectedRunnerId,
            status: 'scheduled',
            total_weight: totals.totalLbs,
            total_value: totals.total,
            collection_amount: collectOldBalance ? Number(selectedClient?.outstanding_balance || 0) : 0,
            scheduled_pickup_time: scheduledTime || new Date().toISOString(),
            notes: runnerNotes,
          });

        if (deliveryError) throw deliveryError;
      }

      return order;
    },
    onSuccess: () => {
      showSuccessToast('Order created successfully');
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
      navigate('/admin/big-plug-clients');
    },
    onError: (error: any) => {
      showErrorToast(error.message || 'Failed to create order');
    },
  });

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
    }
  };

  const canProceed = () => {
    if (currentStep === 'client') return !!selectedClientId;
    if (currentStep === 'products') return orderItems.length > 0;
    if (currentStep === 'payment') return true;
    if (currentStep === 'delivery') {
      if (deliveryMethod === 'runner') return !!selectedRunnerId;
      if (deliveryMethod === 'pickup') return !!pickupWarehouse;
      return false;
    }
    return true;
  };

  // Auto-set delivery address
  useEffect(() => {
    if (selectedClient && selectedClient.address) {
      // Address is already set in client
    }
  }, [selectedClient]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📦 New Order</h1>
          <p className="text-muted-foreground">Multi-step order creation workflow</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/admin/big-plug-clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`flex-1 flex items-center ${
                index < steps.length - 1 ? 'pr-2' : ''
              }`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                index < currentStepIndex
                  ? 'bg-green-500 text-white'
                  : index === currentStepIndex
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {index < currentStepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  index < currentStepIndex ? 'bg-green-500' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-sm font-medium">
          {steps[currentStepIndex].label}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {/* Step 1: Client */}
        {currentStep === 'client' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">STEP 1: CLIENT</h3>
            <div>
              <Label>Select Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Credit Status:</span>
                    <div className="font-semibold">
                      ${Number(selectedClient.outstanding_balance || 0).toLocaleString()} owed
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Credit Limit:</span>
                    <div className="font-semibold">
                      ${Number(selectedClient.credit_limit || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available:</span>
                    <div className={`font-semibold ${
                      availableCredit < totals.total ? 'text-red-600' : ''
                    }`}>
                      ${availableCredit.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <div className="font-semibold">
                      Net {selectedClient.payment_terms || 7} days
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reliability:</span>
                    <div className="font-semibold">
                      ⭐{'⭐'.repeat(Math.floor(Number(selectedClient.reliability_score || 50) / 20))}
                    </div>
                  </div>
                </div>

                {creditWarnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-1">⚠️ WARNING:</div>
                      {creditWarnings.map((warning, i) => (
                        <div key={i}>• {warning}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Products */}
        {currentStep === 'products' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">STEP 2: PRODUCTS</h3>
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="flex gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Select
                      value={item.product_id}
                      onValueChange={(id) => {
                        const product = inventory?.find(p => p.id === id);
                        if (product) {
                          const updated = [...orderItems];
                          updated[index] = {
                            product_id: product.id,
                            product_name: product.product_name,
                            quantity_lbs: updated[index].quantity_lbs,
                            unit_price: Number((product as any).price_per_lb || (product as any).wholesale_price || (product as any).base_price || 3000),
                            available_lbs: Number(product.quantity_lbs || 0),
                          };
                          setOrderItems(updated);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory?.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.product_name} ({Number(product.quantity_lbs || 0).toFixed(1)} lbs available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="Lbs"
                      value={item.quantity_lbs || ''}
                      onChange={(e) => {
                        const updated = [...orderItems];
                        updated[index].quantity_lbs = parseFloat(e.target.value) || 0;
                        setOrderItems(updated);
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="Price/lb"
                      value={item.unit_price || ''}
                      onChange={(e) => {
                        const updated = [...orderItems];
                        updated[index].unit_price = parseFloat(e.target.value) || 0;
                        setOrderItems(updated);
                      }}
                    />
                  </div>
                  <div className="w-24 text-right">
                    <div className="font-semibold">
                      ${((item.quantity_lbs || 0) * (item.unit_price || 0)).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
                  >
                    ×
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => setOrderItems([...orderItems, {
                  product_id: '',
                  product_name: '',
                  quantity_lbs: 0,
                  unit_price: 3000,
                }])}
              >
                <Package className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>

            {/* Totals */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Total Weight:</span>
                <span className="font-semibold">{totals.totalLbs.toFixed(1)} lbs</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">${totals.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Cost (64%):</span>
                <span>${cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>Profit:</span>
                <span className="font-bold text-emerald-600">
                  ${profit.toLocaleString()} ({margin.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 'payment' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">STEP 3: PAYMENT TERMS</h3>
            <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
              <div className="flex items-start space-x-2 border rounded p-4">
                <RadioGroupItem value="cash" id="cash" />
                <div className="flex-1">
                  <Label htmlFor="cash" className="font-semibold cursor-pointer">
                    Paid in Full (Cash/Transfer) ✅
                  </Label>
                </div>
              </div>

              <div className="flex items-start space-x-2 border rounded p-4">
                <RadioGroupItem value="credit" id="credit" />
                <div className="flex-1">
                  <Label htmlFor="credit" className="font-semibold cursor-pointer">
                    Credit (Invoice) - Net {selectedClient?.payment_terms || 7} days
                  </Label>
                </div>
              </div>

              <div className="flex items-start space-x-2 border rounded p-4">
                <RadioGroupItem value="partial" id="partial" />
                <div className="flex-1">
                  <Label htmlFor="partial" className="font-semibold cursor-pointer">
                    Partial (Pay $____, Credit $____)
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {(paymentMethod === 'credit' || paymentMethod === 'partial') && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>

                {paymentMethod === 'partial' && (
                  <div>
                    <Label>Partial Payment Amount</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={partialPaymentAmount}
                      onChange={(e) => setPartialPaymentAmount(e.target.value)}
                    />
                  </div>
                )}

                <div className="text-sm">
                  <div className="font-semibold mb-2">New Credit Balance:</div>
                  <div className="text-2xl">
                    ${newBalance.toLocaleString()}
                  </div>
                  {overCreditLimit && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        ⚠️ OVER CREDIT LIMIT by ${(newBalance - Number(selectedClient?.credit_limit || 0)).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Delivery */}
        {currentStep === 'delivery' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">STEP 4: DELIVERY</h3>
            <RadioGroup value={deliveryMethod} onValueChange={(v: any) => setDeliveryMethod(v)}>
              <div className="flex items-start space-x-2 border rounded p-4">
                <RadioGroupItem value="runner" id="runner" />
                <div className="flex-1">
                  <Label htmlFor="runner" className="font-semibold cursor-pointer">
                    Runner Delivery
                  </Label>
                </div>
              </div>

              <div className="flex items-start space-x-2 border rounded p-4">
                <RadioGroupItem value="pickup" id="pickup" />
                <div className="flex-1">
                  <Label htmlFor="pickup" className="font-semibold cursor-pointer">
                    Client Pickup (Warehouse)
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {deliveryMethod === 'runner' && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div>
                  <Label>Assign Runner</Label>
                  <Select value={selectedRunnerId} onValueChange={setSelectedRunnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose runner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {runners?.map(runner => (
                        <SelectItem key={runner.id} value={runner.id}>
                          {runner.full_name} ({runner.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Scheduled Time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>

                {Number(selectedClient?.outstanding_balance || 0) > 0 && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="collect"
                      checked={collectOldBalance}
                      onChange={(e) => setCollectOldBalance(e.target.checked)}
                    />
                    <Label htmlFor="collect" className="cursor-pointer">
                      Also Collect: ${Number(selectedClient?.outstanding_balance || 0).toLocaleString()} (outstanding balance)
                    </Label>
                  </div>
                )}
              </div>
            )}

            {deliveryMethod === 'pickup' && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div>
                  <Label>Pickup From Warehouse</Label>
                  <Select value={pickupWarehouse} onValueChange={setPickupWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse-a">Warehouse A - Brooklyn</SelectItem>
                      <SelectItem value="warehouse-b">Warehouse B - Queens</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Notes */}
        {currentStep === 'notes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">STEP 5: NOTES</h3>
            <div>
              <Label>Internal Notes</Label>
              <Textarea
                placeholder="Risky - already over credit. Marcus should collect old balance before delivering new product."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={4}
              />
            </div>

            {deliveryMethod === 'runner' && (
              <div>
                <Label>Message to Runner</Label>
                <Textarea
                  placeholder="MUST collect $38k before dropping off new product. If no payment, bring product back to warehouse."
                  value={runnerNotes}
                  onChange={(e) => setRunnerNotes(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 6: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">ORDER SUMMARY</h3>
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div>
                <span className="text-muted-foreground">Client:</span>
                <div className="font-semibold">{selectedClient?.business_name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Products:</span>
                <div className="font-semibold">
                  {totals.totalLbs.toFixed(1)} lbs ({orderItems.map(i => i.product_name).join(', ')})
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Value:</span>
                <div className="font-semibold">${totals.total.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Payment:</span>
                <div className="font-semibold capitalize">{paymentMethod}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Delivery:</span>
                <div className="font-semibold capitalize">
                  {deliveryMethod === 'runner' ? `Runner: ${runners?.find(r => r.id === selectedRunnerId)?.full_name || 'Not assigned'}` : 'Client Pickup'}
                </div>
              </div>
              {collectOldBalance && (
                <div className="text-orange-600 font-semibold">
                  ⚠️ Collect ${Number(selectedClient?.outstanding_balance || 0).toLocaleString()} outstanding first
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t mt-6">
          <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {currentStepIndex < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => createOrder.mutate()}
                disabled={createOrder.isPending || !canProceed()}
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create Order & Assign Runner
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

