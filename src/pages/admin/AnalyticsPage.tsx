/**
 * Analytics Page
 * Self-hosted analytics dashboard inspired by Plausible, Umami, and Matomo
 */

import { SelfHostedAnalytics } from '@/components/admin/analytics/SelfHostedAnalytics';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { useNavigate } from 'react-router-dom';

export default function AnalyticsPage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOHead title="Analytics Dashboard" />
      <div className="container mx-auto p-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
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

