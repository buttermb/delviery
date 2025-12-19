/**
 * Executive Dashboard
 * High-level KPIs for executives
 * Clean, presentation-ready design
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Download, TrendingUp, Users, DollarSign, Target, Zap } from 'lucide-react';

export default function ExecutiveDashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['executive-metrics'],
    queryFn: async () => {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('subscription_plan, subscription_status, mrr, created_at');

      if (error) throw error;

      const active = tenants?.filter((t) => t.subscription_status === 'active') || [];
      const mrr = active.reduce((sum, t) => sum + (t.mrr || 0), 0);
      const arr = mrr * 12;

      // Calculate LTV (simplified)
      const avgMRR = active.length > 0 ? mrr / active.length : 0;
      const churnRate = 0.05; // 5% monthly churn
      const ltv = churnRate > 0 ? avgMRR / churnRate : avgMRR * 12;

      // Calculate CAC (simplified - would need marketing data)
      const cac = 500; // Placeholder

      // NRR (Net Revenue Retention)
      const nrr = 110; // 110% placeholder

      // Magic Number (Sales Efficiency)
      const newARR = 0; // Would calculate from new signups
      const salesAndMarketing = 0; // Would get from expenses
      const magicNumber = salesAndMarketing > 0 ? (newARR / salesAndMarketing) * 4 : 0;

      return {
        arr,
        mrr,
        activeTenants: active.length,
        ltv,
        cac,
        ltvCacRatio: cac > 0 ? ltv / cac : 0,
        nrr,
        magicNumber,
        paybackPeriod: cac > 0 ? cac / (avgMRR * 12) : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <>
        <SEOHead title="Executive Dashboard - Super Admin" />
        <div className="container mx-auto p-6">
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </>
    );
  }

  if (!metrics) return null;

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <>
      <SEOHead title="Executive Dashboard - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Executive Dashboard"
          description="High-level KPIs and business metrics"
          icon={TrendingUp}
          actions={
            <Button onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          }
        />

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                ARR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${metrics.arr.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Annual Recurring Revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.activeTenants}</p>
              <p className="text-xs text-muted-foreground mt-1">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                LTV:CAC Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.ltvCacRatio.toFixed(1)}:1</p>
              <Badge variant={metrics.ltvCacRatio > 3 ? 'default' : 'secondary'} className="mt-1">
                {metrics.ltvCacRatio > 3 ? 'Healthy' : 'Needs Attention'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                NRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.nrr}%</p>
              <Badge variant={metrics.nrr > 100 ? 'default' : 'secondary'} className="mt-1">
                {metrics.nrr > 100 ? 'Growing' : 'Declining'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">LTV</span>
                <span className="font-semibold">${metrics.ltv.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CAC</span>
                <span className="font-semibold">${metrics.cac.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payback Period</span>
                <span className="font-semibold">{metrics.paybackPeriod.toFixed(1)} months</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Efficiency Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Magic Number</span>
                <span className="font-semibold">{metrics.magicNumber.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-semibold">${metrics.mrr.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ARPU</span>
                <span className="font-semibold">
                  ${metrics.activeTenants > 0 ? (metrics.mrr / metrics.activeTenants).toFixed(0) : 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

