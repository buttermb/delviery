/**
 * Usage Dashboard Widget
 * Displays current usage vs limits for all resources
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useNavigate } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";

const RESOURCE_LABELS: Record<string, string> = {
  customers: 'Customers',
  menus: 'Menus',
  products: 'Products',
  locations: 'Locations',
  users: 'Team Members',
};

export function UsageDashboardWidget() {
  const { getCurrent, getLimit, tenant } = useTenantLimits();
  const { tenant: tenantData } = useTenantAdminAuth();
  const navigate = useNavigate();

  if (!tenant) return null;

  const resources: Array<'customers' | 'menus' | 'products' | 'locations' | 'users'> = [
    'customers',
    'menus',
    'products',
    'locations',
    'users',
  ];

  const resourcesData = resources.map((resource) => {
    const current = getCurrent(resource);
    const limit = getLimit(resource);
    const percentage = limit === Infinity ? 0 : (current / limit) * 100;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (percentage >= 95) status = 'critical';
    else if (percentage >= 80) status = 'warning';

    return {
      resource,
      label: RESOURCE_LABELS[resource],
      current,
      limit,
      percentage,
      status,
      isUnlimited: limit === Infinity,
    };
  });

  const hasWarnings = resourcesData.some((r) => r.status !== 'healthy' && !r.isUnlimited);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resource Usage
            </CardTitle>
            <CardDescription>Monitor your plan limits and usage</CardDescription>
          </div>
          {hasWarnings && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/${tenantData?.slug}/admin/billing`)}
            >
              Upgrade Plan
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {resourcesData.map((item) => (
          <div key={item.resource} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {item.status === 'healthy' && !item.isUnlimited && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {item.status === 'warning' && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                {item.status === 'critical' && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <span className="text-muted-foreground">
                {item.current} / {item.isUnlimited ? '∞' : item.limit}
              </span>
            </div>

            {!item.isUnlimited && (
              <>
                <Progress
                  value={item.percentage}
                  className={`h-2 ${item.status === 'critical'
                      ? 'bg-red-100 [&>div]:bg-red-500'
                      : item.status === 'warning'
                        ? 'bg-yellow-100 [&>div]:bg-yellow-500'
                        : ''
                    }`}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {Math.round(item.percentage)}% used
                </div>
              </>
            )}

            {item.isUnlimited && (
              <div className="text-xs text-green-600 dark:text-green-400">
                Unlimited
              </div>
            )}
          </div>
        ))}

        {hasWarnings && (
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-2">
              You're approaching your plan limits. Upgrade to continue growing.
            </div>
            <Button
              onClick={() => navigate(`/${tenantData?.slug}/admin/billing`)}
              className="w-full"
              size="sm"
            >
              View Upgrade Options
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
