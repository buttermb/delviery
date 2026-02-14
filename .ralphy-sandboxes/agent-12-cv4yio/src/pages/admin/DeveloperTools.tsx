/**
 * Developer Tools Page
 * Utilities for debugging and development
 */

import { JWTDecoder } from '@/components/admin/tools/JWTDecoder';
import { URLEncoder } from '@/components/admin/tools/URLEncoder';
import { PageHeader } from '@/components/shared/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Code2 } from 'lucide-react';

export default function DeveloperTools() {
  return (
    <>
      <SEOHead title="Developer Tools - Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Developer Tools"
          description="Utilities for debugging, token inspection, and API development"
          icon={<Code2 className="h-8 w-8" />}
        />

        <div className="grid gap-6">
          <JWTDecoder />
          <URLEncoder />
        </div>
      </div>
    </>
  );
}

