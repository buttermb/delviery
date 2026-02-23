/**
 * KPI Card Component
 * Reusable card component for displaying key performance indicators
 */

import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";

export interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  variant?: 'default' | 'warning' | 'success' | 'destructive';
  trend?: { value: number; label: string };
  href?: string;
}

export function KPICard({ title, value, icon, description, variant = 'default', trend, href }: KPICardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const variantClasses = {
    default: 'text-primary',
    warning: 'text-orange-500',
    success: 'text-green-600',
    destructive: 'text-red-600',
  };

  const fullPath = href && tenantSlug
    ? `/${tenantSlug}${href}`
    : href;

  const card = (
    <Card className={`hover:shadow-md transition-shadow${fullPath ? ' cursor-pointer hover:scale-[1.01] transition-all' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={variantClasses[variant]}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={trend.value >= 0 ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
              {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
        {!trend && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  if (fullPath) {
    return <Link to={fullPath} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{card}</Link>;
  }

  return card;
}

export function KPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
