/**
 * Analytics Page
 * Self-hosted analytics dashboard inspired by Plausible, Umami, and Matomo
 */

import { SelfHostedAnalytics } from '@/components/admin/analytics/SelfHostedAnalytics';
import { SEOHead } from '@/components/SEOHead';

export default function AnalyticsPage() {
  return (
    <>
      <SEOHead title="Analytics Dashboard" />
      <div className="container mx-auto p-6">
        <SelfHostedAnalytics />
      </div>
    </>
  );
}

