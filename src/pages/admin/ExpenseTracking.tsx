import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingDown, Calendar, Tag } from 'lucide-react';

export default function ExpenseTracking() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

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
        <div className="text-center">Loading expenses...</div>
      </div>
    );
  }

  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0) || 0;
  const monthlyExpenses = (expenses || []).reduce((acc: any, expense: any) => {
    const month = new Date(expense.created_at).toLocaleDateString('en-US', { month: 'short' });
    const existing = acc.find((item: any) => item.month === month);
    const amount = parseFloat(expense.amount || 0);
    if (existing) {
      existing.amount += amount;
    } else {
      acc.push({ month, amount });
    }
    return acc;
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Expense Tracking</h1>
        <p className="text-muted-foreground">Monitor and categorize business expenses</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyExpenses.find((m: any) => m.month === new Date().toLocaleDateString('en-US', { month: 'short' }))?.amount?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(expenses?.map((e: any) => e.category)).size || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>Latest expense entries</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses && expenses.length > 0 ? (
            <div className="space-y-4">
              {expenses.slice(0, 20).map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{expense.description || 'No description'}</div>
                    <div className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {expense.category || 'Uncategorized'}
                      </span>
                      {' • '}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(expense.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-red-600">
                    -${(expense.amount || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No expenses tracked yet. Expenses will appear here once the expenses table is created.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

