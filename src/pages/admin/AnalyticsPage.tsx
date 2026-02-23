/**
 * Analytics Page
 * Self-hosted analytics dashboard inspired by Plausible, Umami, and Matomo
 */

import { SelfHostedAnalytics } from '@/components/admin/analytics/SelfHostedAnalytics';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

export default function AnalyticsPage() {
  const { navigateToAdmin } = useTenantNavigation();

  return (
    <>
      <SEOHead title="Analytics Dashboard" />
      <div className="container mx-auto p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateToAdmin('analytics-hub')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <SelfHostedAnalytics />
      </div>
    </>
  );
}

