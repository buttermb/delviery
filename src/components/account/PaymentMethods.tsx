/**
 * Payment Methods Component
 * Manage saved payment methods (persisted to Supabase)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Lock from "lucide-react/dist/esm/icons/lock";
import Shield from "lucide-react/dist/esm/icons/shield";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentMethod {
  id: string;
  type: 'cash' | 'bitcoin' | 'card';
  label: string;
  last4?: string;
  is_default: boolean;
}

// Map database row to component interface
interface DbPaymentMethod {
  id: string;
  payment_type: string;
  card_brand: string | null;
  card_last_four: string | null;
  is_default: boolean | null;
}

function mapDbToPaymentMethod(row: DbPaymentMethod): PaymentMethod {
  return {
    id: row.id,
    type: row.payment_type as 'cash' | 'bitcoin' | 'card',
    label: row.card_brand || row.payment_type,
    last4: row.card_last_four || undefined,
    is_default: row.is_default ?? false,
  };
}

export default function PaymentMethods() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch payment methods from database
  const { data: paymentMethods = [], isLoading } = useQuery({
    queryKey: ['user-payment-methods', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (error) throw error;

      // If no payment methods, return defaults
      if (!data || data.length === 0) {
        return [
          { id: 'default-cash', type: 'cash' as const, label: 'Cash on Delivery', is_default: true },
          { id: 'default-bitcoin', type: 'bitcoin' as const, label: 'Bitcoin / USDC', is_default: false },
        ];
      }
      return data.map(mapDbToPaymentMethod);
    },
    enabled: !!user?.id,
  });

  // Delete payment method mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Don't delete default placeholders
      if (id.startsWith('default-')) {
        throw new Error('Cannot delete default payment options');
      }
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-payment-methods'] });
      toast({ title: 'Payment method removed' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove payment method',
        variant: 'destructive'
      });
    }
  });

  // Set default payment method mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      // First, unset all defaults
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id);
      // Then set the new default
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-payment-methods'] });
      toast({ title: 'Default payment method updated' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update default',
        variant: 'destructive'
      });
    }
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
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
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
        )}

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

