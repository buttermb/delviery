/**
 * System Audit Page
 *
 * Admin page for running comprehensive system audits
 * Accessible at /:tenantSlug/admin/system-audit
 */

import { SEOHead } from '@/components/SEOHead';
import { AdminAuditPanel } from '@/components/admin/AdminAuditPanel';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';

export function SystemAuditPage() {
  return (
    <>
      <SEOHead
        title="System Audit"
        description="Comprehensive admin panel health check and diagnostics"
      />
      <div className="space-y-4">
        <HubBreadcrumbs
          hubName="settings"
          hubHref="settings-hub"
          currentTab="System Audit"
        />
        <AdminAuditPanel />
      </div>
    </>
  );
}

export default SystemAuditPage;
