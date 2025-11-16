/**
 * Super Admin Analytics Page
 * Advanced analytics with revenue forecasting, churn analysis, LTV, and cohorts
 */

import { RevenueForecastChart } from '@/components/super-admin/analytics/RevenueForecastChart';
import { ChurnAnalysisWidget } from '@/components/super-admin/analytics/ChurnAnalysisWidget';
import { LTVCalculator } from '@/components/super-admin/analytics/LTVCalculator';
import { CohortAnalysis } from '@/components/super-admin/analytics/CohortAnalysis';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Calculator, Users } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <>
      <SEOHead title="Analytics - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Advanced Analytics"
          description="Revenue forecasting, churn analysis, lifetime value, and cohort insights"
          icon={BarChart3}
        />

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Forecast</TabsTrigger>
            <TabsTrigger value="churn">Churn Analysis</TabsTrigger>
            <TabsTrigger value="ltv">LTV Calculator</TabsTrigger>
            <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RevenueForecastChart />
              <ChurnAnalysisWidget />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LTVCalculator />
              <CohortAnalysis />
            </div>
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueForecastChart />
          </TabsContent>

          <TabsContent value="churn">
            <ChurnAnalysisWidget />
          </TabsContent>

          <TabsContent value="ltv">
            <LTVCalculator />
          </TabsContent>

          <TabsContent value="cohorts">
            <CohortAnalysis />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

