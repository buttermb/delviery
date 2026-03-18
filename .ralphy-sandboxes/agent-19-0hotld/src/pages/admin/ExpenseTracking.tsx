import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Calendar, Tag, Plus, Loader2, Receipt,
  TrendingDown, X, Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { queryKeys } from '@/lib/queryKeys';
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable';
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar';
import type { ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { invalidateOnEvent } from '@/lib/invalidation';
import { CHART_COLORS } from '@/lib/chartColors';

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
  const [searchQuery, setSearchQuery] = useState('');
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
    queryKey: queryKeys.expenses.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('id, description, amount, category, notes, created_at, tenant_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
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
        .from('expenses')
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
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.byTenant(tenantId) });
      if (tenantId) {
        invalidateOnEvent(queryClient, 'EXPENSE_CREATED', tenantId);
      }
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
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.byTenant(tenantId) });
      if (tenantId) {
        invalidateOnEvent(queryClient, 'EXPENSE_DELETED', tenantId);
      }
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

  const columns: ResponsiveColumn<Expense>[] = [
    {
      header: 'Description',
      accessorKey: 'description',
      cell: (expense) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{expense.description || 'No description'}</span>
          <Badge variant="outline" className="w-fit text-xs">
            <Tag className="h-3 w-3 mr-1 inline-block align-text-bottom" />
            {expense.category || 'Uncategorized'}
          </Badge>
        </div>
      )
    },
    {
      header: 'Date',
      accessorKey: 'created_at',
      cell: (expense) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatSmartDate(expense.created_at)}
        </span>
      )
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: (expense) => (
        <span className="font-bold text-red-600 whitespace-nowrap">
          -{formatCurrency(parseFloat(String(expense.amount ?? 0)))}
        </span>
      )
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (expense) => (
        <div className="flex justify-end pr-2">
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
      )
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) {
      showErrorToast('Missing fields', 'Please fill in description and amount');
      return;
    }
    await addExpenseMutation.mutateAsync(formData);
  };

  // Filter expenses
  const filteredExpenses = (expenses ?? []).filter((e: Expense) => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSearch = !searchQuery || e.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate metrics
  const totalExpenses = filteredExpenses.reduce((sum: number, e: Expense) => sum + parseFloat(String(e.amount ?? 0)), 0);
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
  const thisMonthExpenses = filteredExpenses
    .filter((e: Expense) => new Date(e.created_at).toLocaleDateString('en-US', { month: 'short' }) === currentMonth)
    .reduce((sum: number, e: Expense) => sum + parseFloat(String(e.amount ?? 0)), 0);

  // Category breakdown for pie chart
  const categoryBreakdown = (expenses ?? []).reduce((acc: Record<string, number>, e: Expense) => {
    const category = e.category || 'Uncategorized';
    acc[category] = (acc[category] ?? 0) + parseFloat(String(e.amount ?? 0));
    return acc;
  }, {});

  const pieChartData = Object.entries(categoryBreakdown)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  // Get unique categories from data
  const uniqueCategories = [...new Set((expenses ?? []).map((e: Expense) => e.category).filter(Boolean))];

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading expenses..." />;
  }

  return (
    <div className="p-4 space-y-4">
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
        <div className={`space-y-4 ${pieChartData.length === 0 ? 'lg:col-span-2' : ''}`}>
          <AdminToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search expenses..."
            actions={
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            }
            filters={
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((cat) => (
                      <SelectItem key={String(cat)} value={String(cat)}>{String(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryFilter !== 'all' && (
                  <Button variant="ghost" size="icon" onClick={() => setCategoryFilter('all')} aria-label="Clear filter" className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            }
          />
          <AdminDataTable
            data={filteredExpenses}
            keyExtractor={(expense) => expense.id}
            isLoading={isLoading}
            columns={columns}
            emptyStateIcon={Receipt}
            emptyStateTitle={searchQuery || categoryFilter !== 'all' ? "No matching expenses" : "No Expenses Recorded"}
            emptyStateDescription={searchQuery || categoryFilter !== 'all' ? "Try adjusting your search or filters." : "Click 'Add Expense' to record your first expense."}
            emptyStateAction={searchQuery || categoryFilter !== 'all' ? {
              label: "Clear Filters",
              onClick: () => { setSearchQuery(""); setCategoryFilter("all"); },
            } : {
              label: "Add First Expense",
              onClick: () => setIsAddDialogOpen(true),
              icon: Plus
            }}
          />
        </div>
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
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={addExpenseMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={addExpenseMutation.isPending} className="gap-2">
                {addExpenseMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
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
