/**
 * At-Risk Tenant Card Component
 * Warning card for tenants that need attention
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHealthTextColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';

interface AtRiskTenant {
  id: string;
  business_name: string;
  health_score: number;
  subscription_status: string;
  mrr: number;
  risk_factors: string[];
}

interface AtRiskTenantCardProps {
  tenant: AtRiskTenant;
  onAction?: (tenantId: string) => void;
  className?: string;
}

export function AtRiskTenantCard({
  tenant,
  onAction,
  className,
}: AtRiskTenantCardProps) {
  const healthColor = getHealthTextColor(tenant.health_score);

  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-warning/20 bg-warning/5',
        'hover:bg-warning/10 transition-colors',
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <Link
              to={`/super-admin/tenants/${tenant.id}`}
              className="font-medium hover:underline"
            >
              {tenant.business_name}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-semibold', healthColor)}>
              Health: {tenant.health_score}
            </span>
            <Badge variant="outline" className="text-xs">
              {tenant.subscription_status}
            </Badge>
          </div>
        </div>
      </div>

      {tenant.risk_factors.length > 0 && (
        <div className="mt-2 space-y-1">
          {tenant.risk_factors.slice(0, 2).map((factor, idx) => (
            <p key={idx} className="text-xs text-muted-foreground">
              • {factor}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.(tenant.id)}
          className="flex-1"
        >
          Take Action
        </Button>
        <Button
          variant="ghost"
          size="sm"
          asChild
        >
          <Link to={`/super-admin/tenants/${tenant.id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

