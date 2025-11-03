import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, Download, Trash2, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  receipt_url?: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Payroll',
  'Inventory',
  'Marketing',
  'Equipment',
  'Insurance',
  'Legal',
  'Other',
];

export default function ExpenseTracking() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    receipt_url: '',
  });
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', tenantId, filterCategory, filterMonth],
    queryFn: async (): Promise<Expense[]> => {
      if (!tenantId) return [];

      try {
        let query = supabase
          .from('expenses')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: false });

        // Apply category filter
        if (filterCategory !== 'all') {
          query = query.eq('category', filterCategory);
        }

        // Apply month filter
        const monthStart = new Date(filterMonth + '-01');
        const monthEnd = new Date(parseInt(filterMonth.slice(0, 4)), parseInt(filterMonth.slice(5, 7)), 0);
        query = query.gte('date', monthStart.toISOString().split('T')[0]).lte('date', monthEnd.toISOString().split('T')[0]);

        const { data, error } = await query;

        if (error && error.code === '42P01') {
          // Table doesn't exist
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') {
          return [];
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'created_at'>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          tenant_id: tenantId,
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
          receipt_url: expense.receipt_url || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Expenses table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tenantId] });
      toast({ title: 'Expense added', description: 'Expense has been successfully added.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add expense',
        variant: 'destructive',
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, ...expense }: Expense) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
          receipt_url: expense.receipt_url || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tenantId] });
      toast({ title: 'Expense updated', description: 'Expense has been successfully updated.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update expense',
        variant: 'destructive',
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tenantId] });
      toast({ title: 'Expense deleted', description: 'Expense has been successfully deleted.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete expense',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      category: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      receipt_url: '',
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      date: expense.date,
      receipt_url: expense.receipt_url || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expenseData = {
      category: formData.category,
      amount: Number(formData.amount),
      description: formData.description,
      date: formData.date,
      receipt_url: formData.receipt_url || undefined,
    };

    if (editingExpense) {
      updateExpenseMutation.mutate({ ...editingExpense, ...expenseData });
    } else {
      createExpenseMutation.mutate(expenseData);
    }
  };

  const monthlyTotal = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
  const categoryTotals = expenses?.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {} as Record<string, number>) || {};

  const handleExport = () => {
    if (!expenses) return;

    const csv = [
      ['Date', 'Category', 'Amount', 'Description'].join(','),
      ...expenses.map((expense) =>
        [
          expense.date,
          expense.category,
          expense.amount,
          expense.description.replace(/,/g, ';'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading expenses...</div>
      </div>
    );
  }

  const expensesTableExists = expenses !== undefined; // If query succeeds, table exists

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expense Tracking</h1>
          <p className="text-muted-foreground">Track and manage business expenses</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!expenses || expenses.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        {Object.entries(categoryTotals)
          .slice(0, 3)
          .map(([category, total]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${total.toFixed(2)}</div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="category">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                    required
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="receipt">Receipt URL (Optional)</Label>
                  <Input
                    id="receipt"
                    type="url"
                    value={formData.receipt_url}
                    onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}>
                  {editingExpense ? 'Update' : 'Add'} Expense
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses ({expenses?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!expensesTableExists ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">Expense tracking requires the expenses table to be created.</p>
              <p className="text-sm">Please run the database migration to create the expenses table.</p>
            </div>
          ) : expenses && expenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{expense.category}</Badge>
                    </TableCell>
                    <TableCell className="font-bold">${Number(expense.amount).toFixed(2)}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>
                      {expense.receipt_url ? (
                        <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(expense)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this expense?')) {
                              deleteExpenseMutation.mutate(expense.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No expenses recorded for this period.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

