/**
 * Report Builder Page
 * Create custom reports with drag-and-drop interface
 */

import { ReportBuilder } from '@/components/super-admin/reports/ReportBuilder';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import FileText from "lucide-react/dist/esm/icons/file-text";

export default function ReportBuilderPage() {
  return (
    <>
      <SEOHead title="Report Builder - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Custom Report Builder"
          description="Create custom reports with metrics, dimensions, and visualizations"
          icon={FileText}
        />

        <ReportBuilder />
      </div>
    </>
  );
}

