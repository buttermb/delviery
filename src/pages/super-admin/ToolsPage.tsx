/**
 * Tools Page
 * Advanced tools for tenant management
 */

import { TenantMigration } from '@/components/super-admin/tools/TenantMigration';
import { PanicResetTool } from '@/components/super-admin/tools/PanicResetTool';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Wrench } from 'lucide-react';

export default function ToolsPage() {
  return (
    <>
      <SEOHead title="Tools - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Admin Tools"
          description="Advanced tools for tenant management and data operations"
          icon={Wrench}
        />

        <div className="grid gap-6">
          <TenantMigration />
          <PanicResetTool />
        </div>
      </div>
    </>
  );
}

