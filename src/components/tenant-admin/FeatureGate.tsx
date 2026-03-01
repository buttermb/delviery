import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';

import { type FeatureId } from '@/lib/featureConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';

interface FeatureGateProps {
  featureId: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureId, children, fallback }: FeatureGateProps) {
  const { canAccess } = useFeatureAccess();
  const { tenantSlug } = useTenantAdminAuth();

  if (!canAccess(featureId)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-2">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Upgrade Required</h2>
          <p className="text-muted-foreground">
            Your current plan does not include access to this section.
          </p>
          <Button asChild>
            <Link to={`/${tenantSlug}/admin/billing`}>
              <Sparkles className="mr-2 h-4 w-4" />
              View Upgrade Options
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
