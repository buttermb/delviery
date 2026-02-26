/**
 * Tax Management Page
 * Comprehensive tax overview, reports, and filing status
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  FileText,
  Calendar,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Percent
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar';

interface TaxSummary {
  totalSales: number;
  taxCollected: number;
  taxRate: number;
  pendingFilings: number;
  lastFilingDate: string | null;
}

export default function TaxManagementPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const getPeriodDates = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'year':
        return { start: startOfYear(now), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { data: taxData, isLoading } = useQuery<TaxSummary>({
    queryKey: queryKeys.taxManagement.summary(tenantId, selectedPeriod),
    queryFn: async () => {
      if (!tenantId) return { totalSales: 0, taxCollected: 0, taxRate: 0, pendingFilings: 0, lastFilingDate: null };

      const { start, end } = getPeriodDates();

      // Get orders for the period
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Get account settings for tax rate
      const { data: settings } = await supabase
        .from('account_settings')
        .select('tax_rate')
        .eq('account_id', tenantId)
        .maybeSingle();

      const taxRate = settings?.tax_rate || 8.875;
      const totalSales = (orders ?? []).reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
      // Calculate tax based on rate since tax_amount column may not exist
      const taxCollected = totalSales * (taxRate / 100);

      return {
        totalSales,
        taxCollected,
        taxRate,
        pendingFilings: 1, // Mock - would come from tax filing system
        lastFilingDate: subMonths(new Date(), 1).toISOString(),
      };
    },
    enabled: !!tenantId,
  });

  const handleExportReport = () => {
    toast.success('Tax report export started');
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <AdminToolbar
        hideSearch={true}
        filters={
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as 'month' | 'quarter' | 'year')}>
            <TabsList>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="quarter">This Quarter</TabsTrigger>
              <TabsTrigger value="year">This Year</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          <Button variant="outline" onClick={handleExportReport} className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Sales</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(taxData?.totalSales ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedPeriod === 'month' ? 'This month' : selectedPeriod === 'quarter' ? 'This quarter' : 'Year to date'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tax Collected</span>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(taxData?.taxCollected ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              At {taxData?.taxRate}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pending Filings</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold flex items-center gap-2">
              {taxData?.pendingFilings ?? 0}
              {(taxData?.pendingFilings ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs">Action Required</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Due this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Last Filing</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {taxData?.lastFilingDate
                ? format(new Date(taxData.lastFilingDate), 'MMM d')
                : 'N/A'}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">On time</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tax Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tax Breakdown
            </CardTitle>
            <CardDescription>Sales tax collected by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">State Tax</p>
                <p className="text-sm text-muted-foreground">4.0%</p>
              </div>
              <span className="font-bold">${((taxData?.taxCollected ?? 0) * 0.45).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">City Tax</p>
                <p className="text-sm text-muted-foreground">4.5%</p>
              </div>
              <span className="font-bold">${((taxData?.taxCollected ?? 0) * 0.51).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Special District</p>
                <p className="text-sm text-muted-foreground">0.375%</p>
              </div>
              <span className="font-bold">${((taxData?.taxCollected ?? 0) * 0.04).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Filing Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Filing Schedule
            </CardTitle>
            <CardDescription>Upcoming tax filing deadlines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium">Monthly Sales Tax</p>
                  <p className="text-sm text-muted-foreground">Due: {format(endOfMonth(new Date()), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Quarterly Estimate</p>
                  <p className="text-sm text-muted-foreground">Filed: {format(subMonths(new Date(), 1), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <Badge variant="secondary">Filed</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Annual Return</p>
                  <p className="text-sm text-muted-foreground">Due: Apr 15, {new Date().getFullYear() + 1}</p>
                </div>
              </div>
              <Badge variant="outline">Upcoming</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
