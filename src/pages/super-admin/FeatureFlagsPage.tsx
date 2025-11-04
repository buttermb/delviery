/**
 * Feature Flags Page
 * Manage feature flags and rollout percentages
 */

import { FeatureFlagManager } from '@/components/super-admin/features/FeatureFlagManager';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Flag } from 'lucide-react';

export default function FeatureFlagsPage() {
  return (
    <>
      <SEOHead title="Feature Flags - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Feature Flags"
          description="Manage feature flags and control feature rollouts"
          icon={Flag}
        />

        <FeatureFlagManager />
      </div>
    </>
  );
}

