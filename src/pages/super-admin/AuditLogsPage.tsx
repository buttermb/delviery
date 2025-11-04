/**
 * Audit Logs Page
 * Complete audit trail viewer for all platform actions
 */

import { AuditLogViewer } from '@/components/super-admin/security/AuditLogViewer';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { ScrollText } from 'lucide-react';

export default function AuditLogsPage() {
  return (
    <>
      <SEOHead title="Audit Logs - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Audit Logs"
          description="Complete audit trail of all actions on the platform"
          icon={ScrollText}
        />

        <AuditLogViewer />
      </div>
    </>
  );
}

