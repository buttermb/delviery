import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, DollarSign, CreditCard } from 'lucide-react';

export default function CashRegister() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [cart, setCart] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['cash-register-transactions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('pos_transactions' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading cash register...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cash Register</h1>
        <p className="text-muted-foreground">Point of sale transaction management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Total</div>
              <div className="text-3xl font-bold">${total.toFixed(2)}</div>
            </div>
            {cart.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Items</div>
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span>{item.name}</span>
                    <span>${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Button className="flex-1" variant="outline">
                Process Payment
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest POS transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Transaction #{transaction.id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold">${(transaction.total || 0).toFixed(2)}</div>
                      <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                        {transaction.status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet. POS transactions will appear here once the pos_transactions table is created.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

