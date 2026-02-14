/**
 * Hotbox Page - Command Center Dashboard
 * 
 * The main landing page for tenant admins.
 * Shows a morning briefing with pulse metrics, attention items, and quick actions.
 * Adapts to the 5 business tiers.
 */

import { HotboxDashboard } from '@/components/admin/hotbox';
import { SEOHead } from '@/components/SEOHead';

export default function HotboxPage() {
  return (
    <>
      <SEOHead
        title="Hotbox | Command Center"
        description="Your business command center - see today's pulse, action items, and quick access to key features"
      />
      <HotboxDashboard />
    </>
  );
}

