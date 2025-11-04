/**
 * Security Page
 * Security scanning and permission management
 */

import { SecurityScanner } from '@/components/super-admin/security/SecurityScanner';
import { AuditLogViewer } from '@/components/super-admin/security/AuditLogViewer';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Scan } from 'lucide-react';

export default function SecurityPage() {
  return (
    <>
      <SEOHead title="Security - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Security & Compliance"
          description="Security scanning, audit logs, and compliance management"
          icon={Shield}
        />

        <Tabs defaultValue="scanner" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scanner">Security Scanner</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <SecurityScanner />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogViewer />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

