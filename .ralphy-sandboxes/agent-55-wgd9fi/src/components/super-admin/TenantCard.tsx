import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  LogIn,
  DollarSign,
  MoreVertical,
  Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { calculateHealthScore } from "@/lib/tenant";
import { getStatusColor, getHealthTextColor, getStatusVariant } from "@/lib/utils/statusColors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { memo } from "react";

interface Tenant {
  id: string;
  business_name?: string;
  subscription_status?: string;
  [key: string]: unknown;
}

interface TenantCardProps {
  tenant: Tenant;
  onView?: (tenantId: string) => void;
  onLoginAs?: (tenantId: string) => void;
  onViewBilling?: (tenantId: string) => void;
}

export const TenantCard = memo(function TenantCard({ 
  tenant, 
  onView, 
  onLoginAs,
  onViewBilling 
}: TenantCardProps) {
  // @ts-expect-error - tenant type mismatch will resolve when types regenerate
  const health = calculateHealthScore(tenant as any);
  const healthScore = health.score;
  const healthColor = getHealthTextColor(healthScore);
  
  // Map health text color to stroke color
  const healthRingColor = 
    healthScore >= 80 ? "stroke-success" :
    healthScore >= 60 ? "stroke-warning" :
    "stroke-destructive";

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, string> = {
      active: "✅ Active",
      trial: "🆓 Trial",
      trialing: "🆓 Trialing",
      past_due: "🔴 Past Due",
      cancelled: "Cancelled",
      canceled: "Cancelled",
      suspended: "Suspended",
    };

    const label = statusLabels[status.toLowerCase()] || status.toUpperCase();
    const statusColor = getStatusColor(status);
    const variant = getStatusVariant(status);

    return (
      <Badge variant={variant} className={statusColor}>
        {label}
      </Badge>
    );
  };

  // Calculate circumference for health score ring (circle with radius 20, so circumference ≈ 125.6)
  const circumference = 2 * Math.PI * 20;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <Card 
      className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10 hover:border-[hsl(var(--super-admin-primary))]/30 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer group"
      onClick={() => onView?.(tenant.id)}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-lg bg-[hsl(var(--super-admin-primary))]/20 flex items-center justify-center border border-[hsl(var(--super-admin-primary))]/30">
                <Building2 className="h-6 w-6 text-[hsl(var(--super-admin-primary))]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-[hsl(var(--super-admin-text))] group-hover:text-[hsl(var(--super-admin-primary))] transition-colors">
                  {(tenant.business_name as string) || 'Unknown'}
                </h3>
                <p className="text-sm text-[hsl(var(--super-admin-text))]/60">{tenant.slug as string}</p>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-[hsl(var(--super-admin-text))]/60 hover:text-[hsl(var(--super-admin-text))] hover:bg-white/10"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="bg-[hsl(var(--super-admin-surface))] border-white/10"
            >
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onView?.(tenant.id);
                }}
                className="text-[hsl(var(--super-admin-text))] hover:bg-white/10"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewBilling?.(tenant.id);
                }}
                className="text-[hsl(var(--super-admin-text))] hover:bg-white/10"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onLoginAs?.(tenant.id);
                }}
                className="text-[hsl(var(--super-admin-text))] hover:bg-white/10"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login As
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Plan & Status */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="border-[hsl(var(--super-admin-primary))]/30 text-[hsl(var(--super-admin-primary))]">
            💼 {((tenant.subscription_plan as string) || '').charAt(0).toUpperCase() + ((tenant.subscription_plan as string) || '').slice(1)}
          </Badge>
          {getStatusBadge((tenant.subscription_status as string) || 'unknown')}
        </div>

        {/* Health Score Ring */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <svg className="transform -rotate-90 w-16 h-16">
              {/* Background ring */}
              <circle
                cx="32"
                cy="32"
                r="20"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
              />
              {/* Health score ring */}
              <circle
                cx="32"
                cy="32"
                r="20"
                fill="none"
                strokeWidth="4"
                className={`${healthRingColor} stroke-[hsl(var(--${healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'destructive'}))]`}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${healthColor}`}>
                {healthScore}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-[hsl(var(--super-admin-text))]/80 font-medium mb-1">
              Health Score
            </p>
            <p className="text-xs text-[hsl(var(--super-admin-text))]/60">
              {health.reasons.length > 0 ? health.reasons[0] : "Healthy"}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--super-admin-text))]/60">💰 MRR</span>
            <span className="text-sm font-semibold text-[hsl(var(--super-admin-text))]">
              {formatCurrency((tenant.mrr as number) || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--super-admin-text))]/60">📅 Joined</span>
            <span className="text-sm text-[hsl(var(--super-admin-text))]/60">
              {formatSmartDate(tenant.created_at as string)}
            </span>
          </div>
          {tenant.last_activity_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--super-admin-text))]/60">Last login</span>
              <span className="text-sm text-[hsl(var(--super-admin-text))]/60">
                {formatSmartDate(tenant.last_activity_at as string)}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-4 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onView?.(tenant.id);
            }}
            className="flex-1 hover:bg-[hsl(var(--super-admin-primary))]/20 hover:text-[hsl(var(--super-admin-primary))] text-[hsl(var(--super-admin-text))]"
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewBilling?.(tenant.id);
            }}
            className="flex-1 hover:bg-[hsl(var(--super-admin-primary))]/20 hover:text-[hsl(var(--super-admin-primary))] text-[hsl(var(--super-admin-text))]"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Billing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onLoginAs?.(tenant.id);
            }}
            className="flex-1 hover:bg-[hsl(var(--super-admin-primary))]/20 hover:text-[hsl(var(--super-admin-primary))] text-[hsl(var(--super-admin-text))]"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Login As
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

