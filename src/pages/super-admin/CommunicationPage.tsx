/**
 * Communication Page
 * Tenant communication hub for announcements and campaigns
 */

import { EmailComposer } from '@/components/super-admin/communication/EmailComposer';
import { CampaignStats } from '@/components/super-admin/communication/CampaignStats';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, BarChart3 } from 'lucide-react';

export default function CommunicationPage() {
  return (
    <>
      <SEOHead title="Communication - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Tenant Communication"
          description="Send announcements, campaigns, and notifications to tenants"
          icon={Mail}
        />

        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="stats">Campaign Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            <EmailComposer />
          </TabsContent>

          <TabsContent value="stats">
            <CampaignStats />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

