import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, AlertCircle, CheckCircle2, Package, DollarSign, Truck, Plus, Trash2 } from "lucide-react";
import { useWholesaleClients, useWholesaleInventory, useWholesaleRunners, useCreateWholesaleOrder } from "@/hooks/useWholesaleData";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/lib/logger";

type OrderStep = 'client' | 'products' | 'payment' | 'delivery' | 'review';

interface OrderItem {
  product_name: string;
  quantity_lbs: number;
  unit_price: number;
}

export default function NewWholesaleOrderReal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  const { tenant } = useTenantAdminAuth();

  const { data: clients = [], isLoading: clientsLoading } = useWholesaleClients();
  const { data: inventory = [], isLoading: inventoryLoading } = useWholesaleInventory(tenant?.id);
  const { data: runners = [], isLoading: runnersLoading } = useWholesaleRunners();
  const createOrder = useCreateWholesaleOrder();

  const [currentStep, setCurrentStep] = useState<OrderStep>('client');
  const [selectedClientId, setSelectedClientId] = useState(clientIdParam || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('credit');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [selectedRunnerId, setSelectedRunnerId] = useState('');

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const availableCredit = selectedClient 
    ? Number(selectedClient.credit_limit) - Number(selectedClient.outstanding_balance)
    : 0;

  useEffect(() => {
    if (selectedClient && !deliveryAddress) {
      setDeliveryAddress(selectedClient.address);
    }
  }, [selectedClient, deliveryAddress]);

  const steps: { key: OrderStep; label: string; icon: any }[] = [
    { key: 'client', label: 'Select Client', icon: Package },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'payment', label: 'Payment', icon: DollarSign },
    { key: 'delivery', label: 'Delivery', icon: Truck },
    { key: 'review', label: 'Review', icon: CheckCircle2 }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const addOrderItem = () => {
    if (inventory.length > 0) {
      setOrderItems([...orderItems, {
        product_name: inventory[0].product_name,
        quantity_lbs: 1,
        unit_price: 3000
      }]);
    }
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
  };

  const calculateTotals = () => {
    const total = orderItems.reduce((sum, item) => sum + (item.quantity_lbs * item.unit_price), 0);
    const cost = total * 0.65; // Assume 65% cost
    const profit = total - cost;
    const margin = total > 0 ? (profit / total) * 100 : 0;
    return { total, cost, profit, margin };
  };

  const totals = calculateTotals();
  const creditCheckPassed = paymentMethod === 'cash' || totals.total <= availableCredit;

  const canProceed = () => {
    if (currentStep === 'client') return !!selectedClientId;
    if (currentStep === 'products') return orderItems.length > 0;
    if (currentStep === 'payment') return true;
    if (currentStep === 'delivery') return !!deliveryAddress;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClientId || orderItems.length === 0) {
      showErrorToast("Invalid Order", "Please select a client and add products");
      return;
    }

    if (paymentMethod === 'credit' && !creditCheckPassed) {
      showErrorToast("Credit Limit Exceeded", "Order exceeds available credit");
      return;
    }

    try {
      await createOrder.mutateAsync({
        client_id: selectedClientId,
        items: orderItems.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity_lbs,
          unit_price: item.unit_price
        })),
        delivery_address: deliveryAddress,
        delivery_notes: deliveryNotes
      });

      navigate('/admin/wholesale-dashboard');
    } catch (error) {
      logger.error('Order creation error', error, { component: 'NewWholesaleOrderReal' });
    }
  };

  if (clientsLoading || inventoryLoading || runnersLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/wholesale-clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">📦 New Wholesale Order</h1>
            <p className="text-sm text-muted-foreground">Create bulk order for wholesale client</p>
          </div>
        </div>

        {/* Progress Steps */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.key;
              const isCompleted = index < currentStepIndex;
              
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex flex-col items-center ${index > 0 ? 'ml-4' : ''}`}>
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-emerald-500 text-white' : ''}
                      ${isCompleted ? 'bg-emerald-500/20 text-emerald-500' : ''}
                      ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                    `}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'font-semibold' : ''}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-0.5 w-16 mx-2 ${isCompleted ? 'bg-emerald-500' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Step Content */}
        <Card className="p-6 min-h-[400px]">
          {/* Client Selection */}
          {currentStep === 'client' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Select Client</h2>
              
              <div className="space-y-3">
                <Label>Choose Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{client.business_name}</span>
                          <Badge variant="outline" className="ml-2">{client.client_type}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="font-semibold mb-2">{selectedClient.business_name}</div>
                  <Separator className="my-3" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit Limit:</span>
                      <span className="font-mono">${Number(selectedClient.credit_limit).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outstanding:</span>
                      <span className="font-mono text-destructive">
                        ${Number(selectedClient.outstanding_balance).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available Credit:</span>
                      <span className="font-mono text-emerald-500">${availableCredit.toLocaleString()}</span>
                    </div>
                  </div>

                  {Number(selectedClient.outstanding_balance) > 0 && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold text-yellow-500">Outstanding Balance</div>
                        <div className="text-muted-foreground">
                          Client has ${Number(selectedClient.outstanding_balance).toLocaleString()} overdue
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Products Selection */}
          {currentStep === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Select Products</h2>
                <Button onClick={addOrderItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>

              {orderItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No products added yet</p>
                  <Button onClick={addOrderItem} className="mt-4">Add First Product</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item, index) => {
                    const inventoryItem = inventory.find(i => i.product_name === item.product_name);
                    const availableQty = inventoryItem ? Number(inventoryItem.quantity_lbs) : 0;
                    const isLowStock = item.quantity_lbs > availableQty;

                    return (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-12 gap-4 items-start">
                          <div className="col-span-4">
                            <Label className="text-xs">Product</Label>
                            <Select 
                              value={item.product_name} 
                              onValueChange={(value) => updateOrderItem(index, 'product_name', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory.map(inv => (
                                  <SelectItem key={inv.id} value={inv.product_name}>
                                    {inv.product_name} ({inv.quantity_lbs} lbs)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isLowStock && (
                              <span className="text-xs text-destructive">Low stock! Only {availableQty} lbs</span>
                            )}
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Quantity (lbs)</Label>
                            <Input 
                              type="number" 
                              value={item.quantity_lbs}
                              onChange={(e) => updateOrderItem(index, 'quantity_lbs', Number(e.target.value))}
                              min="0.1"
                              step="0.1"
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Price/lb</Label>
                            <Input 
                              type="number" 
                              value={item.unit_price}
                              onChange={(e) => updateOrderItem(index, 'unit_price', Number(e.target.value))}
                              min="0"
                            />
                          </div>
                          <div className="col-span-2 flex flex-col items-end justify-between h-full pt-6">
                            <span className="font-mono font-semibold">
                              ${(item.quantity_lbs * item.unit_price).toLocaleString()}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeOrderItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  <Separator />
                  
                  <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Order Total</div>
                      <div className="text-2xl font-bold">${totals.total.toLocaleString()}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm text-muted-foreground">Estimated Profit</div>
                      <div className="text-xl font-semibold text-emerald-500">
                        ${totals.profit.toLocaleString()} ({totals.margin.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Terms */}
          {currentStep === 'payment' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Payment Terms</h2>

              <div className="space-y-3">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Card 
                    className={`p-4 cursor-pointer ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-500/5' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <div className="font-semibold">Cash Payment</div>
                    <div className="text-sm text-muted-foreground">Paid in full</div>
                  </Card>
                  <Card 
                    className={`p-4 cursor-pointer ${paymentMethod === 'credit' ? 'border-emerald-500 bg-emerald-500/5' : ''}`}
                    onClick={() => setPaymentMethod('credit')}
                  >
                    <div className="font-semibold">Credit</div>
                    <div className="text-sm text-muted-foreground">
                      Net {selectedClient?.payment_terms || 7} days
                    </div>
                  </Card>
                </div>
              </div>

              {paymentMethod === 'credit' && selectedClient && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Order Total:</span>
                    <span className="font-mono font-semibold">${totals.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current Balance:</span>
                    <span className="font-mono">${Number(selectedClient.outstanding_balance).toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">New Balance:</span>
                    <span className="font-mono font-bold">
                      ${(totals.total + Number(selectedClient.outstanding_balance)).toLocaleString()}
                    </span>
                  </div>

                  {!creditCheckPassed && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold text-destructive">Credit Limit Exceeded</div>
                        <div>Order total exceeds available credit by ${(totals.total - availableCredit).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delivery */}
          {currentStep === 'delivery' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Delivery Details</h2>

              <div className="space-y-3">
                <div>
                  <Label>Delivery Address</Label>
                  <Textarea 
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter delivery address..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Runner (Optional)</Label>
                  <Select value={selectedRunnerId} onValueChange={setSelectedRunnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign later" />
                    </SelectTrigger>
                    <SelectContent>
                      {runners.map(runner => (
                        <SelectItem key={runner.id} value={runner.id}>
                          {runner.full_name} - {runner.vehicle_type} ({runner.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Delivery Notes</Label>
                  <Textarea 
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Special instructions..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Review Order</h2>

              <Card className="p-4">
                <div className="font-semibold mb-2">Client</div>
                <div>{selectedClient?.business_name}</div>
                <div className="text-sm text-muted-foreground">{selectedClient?.address}</div>
              </Card>

              <Card className="p-4">
                <div className="font-semibold mb-3">Products ({orderItems.length})</div>
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.product_name} ({item.quantity_lbs} lbs)</span>
                      <span className="font-mono">${(item.quantity_lbs * item.unit_price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="font-mono">${totals.total.toLocaleString()}</span>
                </div>
              </Card>

              <Card className="p-4">
                <div className="font-semibold mb-2">Payment</div>
                <div className="text-sm">
                  {paymentMethod === 'cash' ? 'Paid in Full (Cash)' : `Credit - Net ${selectedClient?.payment_terms || 7} days`}
                </div>
              </Card>

              <Card className="p-4">
                <div className="font-semibold mb-2">Delivery</div>
                <div className="text-sm">{deliveryAddress}</div>
                {deliveryNotes && (
                  <div className="text-sm text-muted-foreground mt-2">Notes: {deliveryNotes}</div>
                )}
              </Card>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}>
            Back
          </Button>
          {currentStep === 'review' ? (
            <Button 
              onClick={handleSubmit} 
              disabled={createOrder.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {createOrder.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          ) : (
            <Button 
              onClick={handleNext} 
              disabled={!canProceed()}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
