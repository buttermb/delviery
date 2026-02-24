import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Calendar, Tag, Plus, Loader2, Receipt,
  TrendingDown, Filter, X, Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TruncatedText } from '@/components/shared/TruncatedText';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

interface Expense {
  id: string;
  description: string;
  amount: string | number;
  category: string;
  notes: string | null;
  created_at: string;
  tenant_id: string;
}

const EXPENSE_CATEGORIES = [
  'Supplies',
  'Utilities',
  'Rent',
  'Payroll',
  'Marketing',
  'Equipment',
  'Transportation',
  'Insurance',
  'Maintenance',
  'Other'
];

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
];

const DEFAULT_EXPENSE_FORM = {
  description: '',
  amount: '',
  category: 'Supplies',
  notes: ''
};

export default function ExpenseTracking() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_EXPENSE_FORM);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_EXPENSE_FORM);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsAddDialogOpen(open);
  }, [resetForm]);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('expenses' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!tenantId) throw new Error('No tenant');

      const { error } = await supabase
        .from('expenses' as any)
        .insert({
          tenant_id: tenantId,
          description: data.description,
          amount: parseFloat(data.amount),
          category: data.category,
          notes: data.notes,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tenantId] });
      showSuccessToast('Expense Added', 'The expense has been recorded successfully');
      setIsAddDialogOpen(false);
      setFormData(DEFAULT_EXPENSE_FORM);
    },
    onError: (error) => {
      logger.error('Failed to add expense', error, { component: 'ExpenseTracking' });
      showErrorToast('Failed to add expense', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase
        .from('expenses' as any)
        .delete()
        .eq('id', expenseId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tenantId] });
      showSuccessToast('Expense Deleted', 'The expense has been removed');
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    },
    onError: (error) => {
      logger.error('Failed to delete expense', error, { component: 'ExpenseTracking' });
      showErrorToast('Failed to delete expense', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  const handleDeleteExpense = async () => {
    if (expenseToDelete) {
      await deleteExpenseMutation.mutateAsync(expenseToDelete);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) {
      showErrorToast('Missing fields', 'Please fill in description and amount');
      return;
    }
    setIsSubmitting(true);
    await addExpenseMutation.mutateAsync(formData);
    setIsSubmitting(false);
  };

  // Filter expenses
  const filteredExpenses = (expenses || []).filter((e: Expense) =>
    categoryFilter === 'all' || e.category === categoryFilter
  );

  // Calculate metrics
  const totalExpenses = filteredExpenses.reduce((sum: number, e: Expense) => sum + parseFloat(String(e.amount || 0)), 0);
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
  const thisMonthExpenses = filteredExpenses
    .filter((e: Expense) => new Date(e.created_at).toLocaleDateString('en-US', { month: 'short' }) === currentMonth)
    .reduce((sum: number, e: Expense) => sum + parseFloat(String(e.amount || 0)), 0);

  // Category breakdown for pie chart
  const categoryBreakdown = (expenses || []).reduce((acc: Record<string, number>, e: Expense) => {
    const category = e.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + parseFloat(String(e.amount || 0));
    return acc;
  }, {});

  const pieChartData = Object.entries(categoryBreakdown)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  // Get unique categories from data
  const uniqueCategories = [...new Set((expenses || []).map((e: Expense) => e.category).filter(Boolean))];

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading expenses..." />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-8 w-8 text-red-500" />
            Expense Tracking
          </h1>
          <p className="text-muted-foreground">Monitor and categorize business expenses</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-red-500/10 to-background border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredExpenses.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-background border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(thisMonthExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">{currentMonth}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-background border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Tag className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{uniqueCategories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">expense categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and List */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        {pieChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Spending by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Expenses */}
        <Card className={pieChartData.length === 0 ? 'lg:col-span-2' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Expenses</CardTitle>
                <CardDescription>Latest expense entries</CardDescription>
              </div>
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryFilter !== 'all' && (
                  <Button variant="ghost" size="icon" onClick={() => setCategoryFilter('all')} aria-label="Clear category filter">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredExpenses.slice(0, 20).map((expense: Expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <TruncatedText text={expense.description || 'No description'} className="font-medium" as="div" />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {expense.category || 'Uncategorized'}
                        </Badge>
                        <span className="text-xs">
                          {formatSmartDate(expense.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-lg font-bold text-red-600">
                        -{formatCurrency(parseFloat(expense.amount || 0))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setExpenseToDelete(expense.id);
                          setDeleteDialogOpen(true);
                        }}
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EnhancedEmptyState
                icon={Receipt}
                title="No Expenses Recorded"
                description="Click 'Add Expense' to record your first expense."
                primaryAction={{
                  label: "Add First Expense",
                  onClick: () => setIsAddDialogOpen(true),
                  icon: Plus
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Add New Expense
            </DialogTitle>
            <DialogDescription>
              Record a business expense to track your spending
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="e.g., Office supplies"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <CurrencyInput
                  id="amount"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteExpense}
        itemType="expense"
        isLoading={deleteExpenseMutation.isPending}
      />
    </div>
  );
}
