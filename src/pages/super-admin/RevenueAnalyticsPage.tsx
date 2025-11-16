/**
 * Revenue Analytics Page
 * Advanced revenue analytics with MRR, expansion, forecasting
 */

import { MRRBreakdownChart } from '@/components/super-admin/revenue/MRRBreakdownChart';
import { ExpansionRevenueChart } from '@/components/super-admin/revenue/ExpansionRevenueChart';
import { RevenueForecastChart } from '@/components/super-admin/analytics/RevenueForecastChart';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

export default function RevenueAnalyticsPage() {
  return (
    <>
      <SEOHead title="Revenue Analytics - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Revenue Analytics"
          description="Advanced revenue metrics, MRR breakdown, and expansion analysis"
          icon={DollarSign}
        />

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mrr">MRR Breakdown</TabsTrigger>
            <TabsTrigger value="expansion">Expansion Revenue</TabsTrigger>
            <TabsTrigger value="forecast">Forecasting</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <MRRBreakdownChart />
            <ExpansionRevenueChart />
            <RevenueForecastChart />
          </TabsContent>

          <TabsContent value="mrr">
            <MRRBreakdownChart />
          </TabsContent>

          <TabsContent value="expansion">
            <ExpansionRevenueChart />
          </TabsContent>

          <TabsContent value="forecast">
            <RevenueForecastChart />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

