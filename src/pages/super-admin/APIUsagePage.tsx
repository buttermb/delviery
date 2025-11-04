/**
 * API Usage Page
 * Comprehensive API monitoring and rate limiting management
 */

import { APIUsageDashboard } from '@/components/super-admin/api/APIUsageDashboard';
import { RateLimitManager } from '@/components/super-admin/api/RateLimitManager';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Shield } from 'lucide-react';

export default function APIUsagePage() {
  return (
    <>
      <SEOHead title="API Usage - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="API Usage & Monitoring"
          description="Monitor API requests, track usage, and manage rate limits"
          icon={Activity}
        />

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Usage Dashboard</TabsTrigger>
            <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <APIUsageDashboard />
          </TabsContent>

          <TabsContent value="rate-limits">
            <RateLimitManager />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

