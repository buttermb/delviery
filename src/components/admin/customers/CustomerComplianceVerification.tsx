/**
 * CustomerComplianceVerification Component
 *
 * Displays cannabis compliance verification status for a customer.
 * Shows: age verified, ID on file, purchase limits, delivery zone validated.
 * Red flags for missing compliance data.
 * Can block order creation if required compliance is missing.
 */

import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  CreditCard,
  MapPin,
  User,
  FileText,
  AlertOctagon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Ban,
} from 'lucide-react';
import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import {
  useCustomerCompliance,
  type ComplianceCheck,
  type ComplianceStatus,
  type ComplianceCheckType,
} from '@/hooks/useCustomerCompliance';

// ============================================================================
// Types
// ============================================================================

interface CustomerComplianceVerificationProps {
  customerId: string;
  customerName?: string;
  className?: string;
  compact?: boolean;
  showBlockWarning?: boolean;
  onComplianceChange?: (isCompliant: boolean, canOrder: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHECK_ICONS: Record<ComplianceCheckType, typeof Shield> = {
  age_verified: User,
  id_on_file: FileText,
  medical_card: CreditCard,
  purchase_limits: Shield,
  delivery_zone: MapPin,
};

const STATUS_COLORS: Record<ComplianceStatus, string> = {
  passed: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800',
  failed: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800',
  pending: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800',
  not_required: 'text-gray-500 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950/30 dark:border-gray-700',
};

const STATUS_ICONS: Record<ComplianceStatus, typeof CheckCircle> = {
  passed: CheckCircle,
  failed: XCircle,
  pending: Clock,
  not_required: CheckCircle,
};

// ============================================================================
// Component
// ============================================================================

export function CustomerComplianceVerification({
  customerId,
  customerName,
  className,
  compact = false,
  showBlockWarning = true,
  onComplianceChange,
}: CustomerComplianceVerificationProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const {
    compliance,
    isLoading,
    error,
    refetch,
    isCompliantForOrdering: _isCompliantForOrdering,
  } = useCustomerCompliance(customerId);

  // Notify parent of compliance changes
  if (onComplianceChange && compliance) {
    onComplianceChange(compliance.isFullyCompliant, compliance.canPlaceOrders);
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Failed to load compliance data
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!compliance) {
    return null;
  }

  const { checks, isFullyCompliant, canPlaceOrders, failedChecks, pendingChecks } = compliance;

  // Summary stats
  const passedCount = checks.filter((c) => c.status === 'passed').length;
  const failedCount = failedChecks.length;
  const pendingCount = pendingChecks.length;

  return (
    <Card className={cn('bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]', className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance Verification
              {/* Overall status badge */}
              {isFullyCompliant ? (
                <Badge className="ml-2 bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Compliant
                </Badge>
              ) : failedCount > 0 ? (
                <Badge className="ml-2 bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  {failedCount} Issue{failedCount > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {pendingCount} Pending
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh compliance data">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh compliance data</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {compact && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={isExpanded ? "Collapse" : "Expand"}>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          {/* Block Warning Banner */}
          {showBlockWarning && !canPlaceOrders && (
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <Ban className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">
                  Orders Blocked
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {customerName || 'This customer'} cannot place orders until compliance issues are resolved.
                  {failedCount > 0 && ` ${failedCount} required verification${failedCount > 1 ? 's' : ''} failed.`}
                </p>
              </div>
            </div>
          )}

          {/* Summary when collapsed */}
          {!isExpanded && compact && (
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                {passedCount} passed
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {failedCount} failed
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                  {pendingCount} pending
                </span>
              )}
            </div>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Failed Checks (shown first with emphasis) */}
            {failedChecks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Requires Attention
                </h4>
                <div className="space-y-2">
                  {failedChecks.map((check) => (
                    <ComplianceCheckItem key={check.type} check={check} />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Checks */}
            {pendingChecks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Verification
                </h4>
                <div className="space-y-2">
                  {pendingChecks.map((check) => (
                    <ComplianceCheckItem key={check.type} check={check} />
                  ))}
                </div>
              </div>
            )}

            {(failedChecks.length > 0 || pendingChecks.length > 0) && (
              <Separator className="my-4" />
            )}

            {/* All Checks */}
            <div className="space-y-2">
              {checks
                .filter((c) => c.status !== 'failed' && c.status !== 'pending')
                .map((check) => (
                  <ComplianceCheckItem key={check.type} check={check} />
                ))}
            </div>

            {/* Compliance Requirements Info */}
            <div className="mt-4 pt-4 border-t border-[hsl(var(--tenant-border))]">
              <p className="text-xs text-muted-foreground">
                Compliance requirements are configured based on your jurisdiction settings.
                {compliance.requirements.blockOrdersIfNonCompliant && (
                  <span className="block mt-1 text-amber-600 dark:text-amber-400">
                    Order creation is blocked for non-compliant customers.
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ComplianceCheckItemProps {
  check: ComplianceCheck;
}

function ComplianceCheckItem({ check }: ComplianceCheckItemProps) {
  const CheckIcon = CHECK_ICONS[check.type];
  const StatusIcon = STATUS_ICONS[check.status];
  const statusColor = STATUS_COLORS[check.status];

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all',
        statusColor
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-white/50 dark:bg-black/20">
          <CheckIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{check.label}</span>
            {!check.isRequired && (
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            )}
          </div>
          <p className="text-sm opacity-90 mt-0.5">{check.description}</p>
          {check.details && (
            <p className="text-xs opacity-75 mt-1">{check.details}</p>
          )}
          {check.lastVerified && (
            <p className="text-xs opacity-60 mt-1">
              Last verified: {format(new Date(check.lastVerified), 'MMM d, yyyy')}
            </p>
          )}
          {check.expiresAt && check.status !== 'failed' && (
            <p className="text-xs opacity-60 mt-1">
              Expires: {format(new Date(check.expiresAt), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <StatusIcon className="h-5 w-5 shrink-0" />
      </div>
    </div>
  );
}

// ============================================================================
// Compact Inline Badge Version
// ============================================================================

interface ComplianceStatusBadgeProps {
  customerId: string;
  showDetails?: boolean;
}

export function ComplianceStatusBadge({
  customerId,
  showDetails = false,
}: ComplianceStatusBadgeProps) {
  const { compliance, isLoading } = useCustomerCompliance(customerId);

  if (isLoading) {
    return <Skeleton className="h-5 w-20" />;
  }

  if (!compliance) {
    return null;
  }

  const { isFullyCompliant, failedChecks, pendingChecks, canPlaceOrders } = compliance;

  if (isFullyCompliant) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Compliant
            </Badge>
          </TooltipTrigger>
          {showDetails && (
            <TooltipContent>
              <p>All compliance checks passed</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (failedChecks.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
              <XCircle className="h-3 w-3 mr-1" />
              {canPlaceOrders ? 'Non-Compliant' : 'Blocked'}
            </Badge>
          </TooltipTrigger>
          {showDetails && (
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Failed checks:</p>
                {failedChecks.map((c) => (
                  <p key={c.type} className="text-xs">
                    - {c.label}
                  </p>
                ))}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </TooltipTrigger>
        {showDetails && (
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">Pending verification:</p>
              {pendingChecks.map((c) => (
                <p key={c.type} className="text-xs">
                  - {c.label}
                </p>
              ))}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
