import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function RevenueReports() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [reportPeriod, setReportPeriod] = useState<'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM format
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['revenue-reports', tenantId, reportPeriod, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!tenantId) return null;

      let startDate: Date;
      let endDate: Date = new Date();

      if (reportPeriod === 'month') {
        startDate = new Date(selectedMonth + '-01');
        endDate = new Date(parseInt(selectedMonth.slice(0, 4)), parseInt(selectedMonth.slice(5, 7)), 0);
      } else {
        startDate = new Date(parseInt(selectedYear), 0, 1);
        endDate = new Date(parseInt(selectedYear), 11, 31);
      }

      // Get orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;
      return orders || [];
    },
    enabled: !!tenantId,
  });

  // Calculate P&L data
  const totalRevenue = revenueData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

  // Get expenses (if expenses table exists)
  const { data: expenses } = useQuery({
    queryKey: ['expenses', tenantId, reportPeriod, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        let startDate: Date;
        let endDate: Date = new Date();

        if (reportPeriod === 'month') {
          startDate = new Date(selectedMonth + '-01');
          endDate = new Date(parseInt(selectedMonth.slice(0, 4)), parseInt(selectedMonth.slice(5, 7)), 0);
        } else {
          startDate = new Date(parseInt(selectedYear), 0, 1);
          endDate = new Date(parseInt(selectedYear), 11, 31);
        }

        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (error && error.code === '42P01') {
          return []; // Expenses table doesn't exist
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Revenue by category
  const categoryRevenue: Record<string, number> = {};
  revenueData?.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      const category = item.products?.category || 'Uncategorized';
      const revenue = Number(item.price || 0) * Number(item.quantity || 0);
      categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
    });
  });

  const categoryData = Object.entries(categoryRevenue)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Expenses by category
  const expenseByCategory: Record<string, number> = {};
  expenses?.forEach((expense: any) => {
    const category = expense.category || 'Uncategorized';
    expenseByCategory[category] = (expenseByCategory[category] || 0) + Number(expense.amount || 0);
  });

  const expenseData = Object.entries(expenseByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const handleExport = () => {
    const reportText = `
REVENUE REPORT
Period: ${reportPeriod === 'month' ? selectedMonth : selectedYear}
Generated: ${new Date().toLocaleDateString()}

REVENUE
Total Revenue: $${totalRevenue.toFixed(2)}

EXPENSES
Total Expenses: $${totalExpenses.toFixed(2)}

PROFIT & LOSS
Profit: $${profit.toFixed(2)}
Profit Margin: ${profitMargin.toFixed(2)}%
`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-report-${reportPeriod}-${reportPeriod === 'month' ? selectedMonth : selectedYear}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading revenue report...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Reports</h1>
          <p className="text-muted-foreground">Generate detailed financial reports and P&L statements</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              variant={reportPeriod === 'month' ? 'default' : 'outline'}
              onClick={() => setReportPeriod('month')}
            >
              Monthly
            </Button>
            <Button
              variant={reportPeriod === 'year' ? 'default' : 'outline'}
              onClick={() => setReportPeriod('year')}
            >
              Yearly
            </Button>
          </div>
          <div>
            {reportPeriod === 'month' ? (
              <div>
                <Label htmlFor="month">Select Month</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="year">Select Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  min="2020"
                  max={new Date().getFullYear()}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${profit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="expenses">Expenses Breakdown</TabsTrigger>
          <TabsTrigger value="pl">P&L Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {expenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No expense data available. Expense tracking requires the expenses table to be created.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pl" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="font-semibold">Revenue</div>
                  <div className="text-right font-bold">${totalRevenue.toFixed(2)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                  <div>Total Expenses</div>
                  <div className="text-right">${totalExpenses.toFixed(2)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-primary/10">
                  <div className="font-semibold">Net Profit</div>
                  <div className={`text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${profit.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

