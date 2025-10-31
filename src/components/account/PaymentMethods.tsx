/**
 * Payment Methods Component
 * Manage saved payment methods
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Trash2, Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethod {
  id: string;
  type: 'cash' | 'bitcoin' | 'card';
  label: string;
  last4?: string;
  is_default: boolean;
}

export default function PaymentMethods() {
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: '1',
      type: 'cash',
      label: 'Cash on Delivery',
      is_default: true
    },
    {
      id: '2',
      type: 'bitcoin',
      label: 'Bitcoin / USDC',
      is_default: false
    }
  ]);

  const handleDelete = (id: string) => {
    setPaymentMethods(paymentMethods.filter(p => p.id !== id));
    toast({ title: 'Payment method removed' });
  };

  const handleSetDefault = (id: string) => {
    setPaymentMethods(paymentMethods.map(p => ({
      ...p,
      is_default: p.id === id
    })));
    toast({ title: 'Default payment method updated' });
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'card':
        return <CreditCard className="h-5 w-5" />;
      case 'bitcoin':
        return <Shield className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getMethodLabel = (type: string) => {
    switch (type) {
      case 'cash':
        return 'Cash on Delivery';
      case 'bitcoin':
        return 'Bitcoin / USDC';
      case 'card':
        return 'Credit Card';
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Manage your payment options for faster checkout
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-primary">
                  {getMethodIcon(method.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{getMethodLabel(method.type)}</span>
                    {method.is_default && (
                      <Badge variant="default" className="text-xs">
                        Default
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Secure
                    </Badge>
                  </div>
                  {method.last4 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      •••• •••• •••• {method.last4}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                {!method.is_default && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetDefault(method.id)}
                  >
                    Set Default
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(method.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Your payment information is securely encrypted and never stored on our servers.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

