import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, AlertCircle, CheckCircle2, Package, DollarSign, Truck } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";

type OrderStep = 'client' | 'products' | 'payment' | 'delivery' | 'review';

export default function NewWholesaleOrder() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OrderStep>('client');
  const [orderData, setOrderData] = useState({
    clientId: '',
    clientName: 'Big Mike\'s Operation',
    creditStatus: { balance: 38000, limit: 50000 },
    products: [] as any[],
    paymentTerms: 'credit',
    deliveryMethod: 'runner',
    runnerId: '',
    notes: ''
  });

  const steps: { key: OrderStep; label: string; icon: any }[] = [
    { key: 'client', label: 'Select Client', icon: Package },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'payment', label: 'Payment Terms', icon: DollarSign },
    { key: 'delivery', label: 'Delivery', icon: Truck },
    { key: 'review', label: 'Review', icon: CheckCircle2 }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const handleNext = () => {
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
    try {
      if (!orderData.clientId) {
        showErrorToast('Please select a client first');
        return;
      }

      // Call the wholesale-order-create edge function with real data
      const { data, error } = await supabase.functions.invoke('wholesale-order-create', {
        body: {
          client_id: orderData.clientId,
          items: orderData.products.length > 0 ? orderData.products : [
            { product_name: 'Blue Dream', quantity: 20, unit_price: 3000 },
            { product_name: 'Wedding Cake', quantity: 10, unit_price: 3200 },
            { product_name: 'Gelato', quantity: 10, unit_price: 3100 }
          ],
          delivery_address: 'Brooklyn East (Big Mike\'s spot)',
          delivery_notes: orderData.notes || 'MUST collect $38k before dropping off new product'
        }
      });

      if (error) throw error;

      showSuccessToast('Order Created', `Order #${data.order_number} created successfully`);
      navigate('/admin/wholesale-dashboard');
    } catch (error) {
      console.error('Order creation error:', error);
      showErrorToast('Order Failed', error instanceof Error ? error.message : 'Failed to create order');
    }
  };

  const calculateTotals = () => {
    const total = 120000;
    const cost = 78400;
    const profit = total - cost;
    const margin = (profit / total) * 100;
    return { total, cost, profit, margin };
  };

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
        <Card className="p-6">
          {currentStep === 'client' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Select Client</h2>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-semibold text-lg">{orderData.clientName}</div>
                    <div className="text-sm text-muted-foreground">Sub-Dealer | Brooklyn East</div>
                  </div>
                  <Badge variant="outline">Selected</Badge>
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credit Limit:</span>
                    <span className="font-mono">${orderData.creditStatus.limit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Outstanding:</span>
                    <span className="font-mono text-destructive">${orderData.creditStatus.balance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Available Credit:</span>
                    <span className="font-mono text-emerald-500">
                      ${(orderData.creditStatus.limit - orderData.creditStatus.balance).toLocaleString()}
                    </span>
                  </div>
                </div>

                {orderData.creditStatus.balance > 0 && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-semibold text-yellow-500">Outstanding Balance</div>
                      <div className="text-muted-foreground">Client has ${orderData.creditStatus.balance.toLocaleString()} overdue. Proceed with caution.</div>
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => navigate('/admin/wholesale-clients')}>
                Change Client
              </Button>
            </div>
          )}

          {currentStep === 'products' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Select Products</h2>
              
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-muted-foreground">
                  <div>Product</div>
                  <div>Qty (lbs)</div>
                  <div>Price/lb</div>
                  <div className="text-right">Subtotal</div>
                </div>

                <div className="space-y-2">
                  {[
                    { name: 'Blue Dream', qty: 20, price: 3000 },
                    { name: 'Wedding Cake', qty: 10, price: 3200 },
                    { name: 'Gelato', qty: 10, price: 3100 }
                  ].map((product, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg items-center">
                      <div className="font-medium">{product.name}</div>
                      <div>
                        <Input 
                          type="number" 
                          defaultValue={product.qty}
                          className="h-8"
                        />
                      </div>
                      <div className="font-mono text-sm">${product.price.toLocaleString()}</div>
                      <div className="text-right font-mono font-semibold">
                        ${(product.qty * product.price).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm">+ Add Product</Button>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Weight:</span>
                    <span className="font-mono font-semibold">40 lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Value:</span>
                    <span className="font-mono font-semibold">${calculateTotals().total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost Basis:</span>
                    <span className="font-mono">${calculateTotals().cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-500">
                    <span>Profit:</span>
                    <span className="font-mono font-semibold">
                      ${calculateTotals().profit.toLocaleString()} ({calculateTotals().margin.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'payment' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Payment Terms</h2>
              
              <div className="space-y-3">
                {[
                  { value: 'cash', label: 'Paid in Full (Cash/Transfer)', icon: '✅' },
                  { value: 'credit', label: 'Credit (Invoice) - Net 7 days', icon: '📄' },
                  { value: 'partial', label: 'Partial Payment', icon: '💰' }
                ].map((option) => (
                  <Card 
                    key={option.value}
                    className={`p-4 cursor-pointer transition-colors ${
                      orderData.paymentTerms === option.value 
                        ? 'border-emerald-500 bg-emerald-500/5' 
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setOrderData({ ...orderData, paymentTerms: option.value })}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{option.icon}</span>
                      <span className="font-medium">{option.label}</span>
                    </div>
                  </Card>
                ))}
              </div>

              {orderData.paymentTerms === 'credit' && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <div className="font-semibold text-yellow-500">Credit Limit Warning</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        New balance will be $158,000 - OVER LIMIT by $108,000
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline">Require Manager Approval</Button>
                        <Button size="sm" variant="outline">Adjust Credit Limit</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'delivery' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Delivery Method</h2>
              
              <div className="space-y-3">
                <Card 
                  className="p-4 cursor-pointer border-emerald-500 bg-emerald-500/5"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5" />
                    <span className="font-medium">Runner Delivery</span>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label>Assign Runner</Label>
                      <select className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md">
                        <option>Runner #3 (Marcus) - Available Now</option>
                        <option>Runner #1 (DeShawn) - Available 3:00 PM</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label>Pickup From</Label>
                      <select className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md">
                        <option>Warehouse A - Brooklyn</option>
                        <option>Warehouse B - Queens</option>
                      </select>
                    </div>

                    <div>
                      <Label>Delivery Address</Label>
                      <Input defaultValue="Brooklyn East (Big Mike's spot)" />
                    </div>

                    <div>
                      <Label>Scheduled Time</Label>
                      <Input type="time" defaultValue="15:00" />
                    </div>

                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="collect" defaultChecked />
                      <Label htmlFor="collect">Also collect $38,000 outstanding balance</Label>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Review Order</h2>
              
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Client</h3>
                  <div className="text-sm space-y-1">
                    <div>{orderData.clientName}</div>
                    <div className="text-muted-foreground">Brooklyn East</div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Products</h3>
                  <div className="text-sm space-y-1">
                    <div>40 lbs total (Blue Dream, Wedding Cake, Gelato)</div>
                    <div className="font-mono">Total: ${calculateTotals().total.toLocaleString()}</div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Payment</h3>
                  <div className="text-sm">Credit (Net 7 days)</div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Delivery</h3>
                  <div className="text-sm space-y-1">
                    <div>Runner #3 (Marcus)</div>
                    <div>Today at 3:00 PM</div>
                    <div className="text-yellow-500">⚠️ Collect $38k outstanding first</div>
                  </div>
                </Card>

                <div>
                  <Label>Special Instructions</Label>
                  <textarea 
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md min-h-[80px]"
                    placeholder="MUST collect $38k before dropping off new product..."
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 'client'}>
            ← Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/admin/wholesale-clients')}>
              Cancel
            </Button>
            {currentStep === 'review' ? (
              <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleSubmit}>
                Create Order & Assign Runner
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
