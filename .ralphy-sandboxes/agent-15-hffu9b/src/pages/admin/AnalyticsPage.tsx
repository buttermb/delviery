/**
 * Analytics Page
 * Self-hosted analytics dashboard inspired by Plausible, Umami, and Matomo
 */

import { SelfHostedAnalytics } from '@/components/admin/analytics/SelfHostedAnalytics';
import { RealtimeTicker } from '@/components/admin/analytics/RealtimeTicker';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsPage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOHead title="Analytics Dashboard" />
      <div className="container mx-auto p-6 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-0"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <RealtimeTicker />
        <SelfHostedAnalytics />
      </div>
    </>
  );
}

