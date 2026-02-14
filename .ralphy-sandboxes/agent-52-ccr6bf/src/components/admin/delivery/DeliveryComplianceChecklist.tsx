/**
 * DeliveryComplianceChecklist Component
 * Compliance checklist for cannabis delivery runners before completing delivery.
 * Enforces age verification, ID checks, zone validation, time restrictions,
 * and quantity limits with audit logging.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import {
  User,
  CreditCard,
  MapPin,
  Clock,
  Package,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  History,
  Lock,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  DeliveryComplianceCheck,
  ComplianceCheckType,
  ComplianceCheckStatus,
  AgeVerificationData,
  IdOnFileData,
  LicensedZoneData,
  TimeRestrictionData,
  QuantityLimitData,
  CustomerStatusData,
} from '@/types/delivery-compliance';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useTenantContext } from '@/hooks/useTenantContext';
import { useDeliveryCompliance, useComplianceAuditLog } from '@/hooks/useDeliveryCompliance';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface DeliveryComplianceChecklistProps {
  orderId: string;
  deliveryId?: string;
  customerId?: string;
  onAllChecksPassed?: () => void;
  onComplianceBlocked?: (blockingChecks: DeliveryComplianceCheck[]) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHECK_ICONS: Record<ComplianceCheckType, React.ElementType> = {
  age_verification: User,
  id_on_file: CreditCard,
  licensed_zone: MapPin,
  time_restriction: Clock,
  quantity_limit: Package,
  customer_status: UserCheck,
};

const CHECK_LABELS: Record<ComplianceCheckType, string> = {
  age_verification: 'Age Verification (21+)',
  id_on_file: 'Valid ID on File',
  licensed_zone: 'Licensed Delivery Zone',
  time_restriction: 'Delivery Hours',
  quantity_limit: 'Quantity Limits',
  customer_status: 'Customer Status',
};

const STATUS_CONFIG: Record<
  ComplianceCheckStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    label: 'Pending',
  },
  passed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    label: 'Passed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    label: 'Failed',
  },
  skipped: {
    icon: AlertTriangle,
    color: 'text-gray-500',
    label: 'Skipped',
  },
  override: {
    icon: Unlock,
    color: 'text-purple-500',
    label: 'Override',
  },
};

// =============================================================================
// Form Schema
// =============================================================================

const overrideFormSchema = z.object({
  override_reason: z
    .string()
    .min(10, 'Please provide at least 10 characters explaining the override reason'),
});

type OverrideFormData = z.infer<typeof overrideFormSchema>;

// =============================================================================
// Component
// =============================================================================

export function DeliveryComplianceChecklist({
  orderId,
  deliveryId,
  customerId,
  onAllChecksPassed,
  onComplianceBlocked,
  className,
}: DeliveryComplianceChecklistProps) {
  const { tenantId, isReady, hasPermission, isAdmin } = useTenantContext();

  // State
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [initializeConfirmOpen, setInitializeConfirmOpen] = useState(false);

  // Hooks
  const {
    complianceChecks,
    passedChecks,
    failedChecks,
    pendingChecks,
    blockingChecks,
    isLoading,
    error,
    refetch,
    allChecksPassed,
    canCompleteDelivery,
    verifyCheck,
    isVerifying,
    overrideCheck,
    isOverriding,
    initializeChecks,
    isInitializing,
    autoVerifySystemChecks,
  } = useDeliveryCompliance(orderId, deliveryId);

  const { data: auditLog = [], isLoading: isAuditLogLoading } = useComplianceAuditLog(
    orderId,
    deliveryId
  );

  // Form
  const overrideForm = useForm<OverrideFormData>({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: {
      override_reason: '',
    },
  });

  // Computed values
  const progressPercentage = useMemo(() => {
    if (complianceChecks.length === 0) return 0;
    return Math.round((passedChecks.length / complianceChecks.length) * 100);
  }, [complianceChecks.length, passedChecks.length]);

  const canOverride = useMemo(() => {
    return isAdmin || hasPermission('manage:deliveries');
  }, [isAdmin, hasPermission]);

  // Effects
  useEffect(() => {
    if (allChecksPassed && onAllChecksPassed) {
      onAllChecksPassed();
    }
  }, [allChecksPassed, onAllChecksPassed]);

  useEffect(() => {
    if (blockingChecks.length > 0 && onComplianceBlocked) {
      onComplianceBlocked(blockingChecks);
    }
  }, [blockingChecks, onComplianceBlocked]);

  // Handlers
  const handleInitializeChecks = useCallback(async () => {
    try {
      await initializeChecks({
        orderId,
        deliveryId,
        customerId,
      });
      toast.success('Compliance checks initialized');
      setInitializeConfirmOpen(false);

      // Auto-verify system checks after initialization
      setTimeout(() => {
        autoVerifySystemChecks();
      }, 500);
    } catch (err) {
      logger.error('Failed to initialize compliance checks', err, {
        component: 'DeliveryComplianceChecklist',
      });
      toast.error('Failed to initialize compliance checks');
    }
  }, [initializeChecks, orderId, deliveryId, customerId, autoVerifySystemChecks]);

  const handleManualVerify = useCallback(
    async (check: DeliveryComplianceCheck, passed: boolean) => {
      try {
        await verifyCheck({
          check_id: check.id,
          status: passed ? 'passed' : 'failed',
          verification_method: 'manual',
          verification_notes: passed ? 'Manually verified by runner' : undefined,
          failure_reason: passed ? undefined : 'Manual verification failed',
        });
        toast.success(passed ? 'Check verified' : 'Check marked as failed');
      } catch (err) {
        logger.error('Failed to verify check', err, {
          component: 'DeliveryComplianceChecklist',
        });
        toast.error('Failed to verify check');
      }
    },
    [verifyCheck]
  );

  const handleOpenOverride = useCallback((checkId: string) => {
    setSelectedCheckId(checkId);
    overrideForm.reset({ override_reason: '' });
    setOverrideDialogOpen(true);
  }, [overrideForm]);

  const handleOverrideSubmit = useCallback(
    async (data: OverrideFormData) => {
      if (!selectedCheckId) return;

      try {
        await overrideCheck({
          check_id: selectedCheckId,
          override_reason: data.override_reason,
        });
        toast.success('Check overridden');
        setOverrideDialogOpen(false);
        setSelectedCheckId(null);
      } catch (err) {
        logger.error('Failed to override check', err, {
          component: 'DeliveryComplianceChecklist',
        });
        toast.error('Failed to override check');
      }
    },
    [selectedCheckId, overrideCheck]
  );

  const renderCheckData = useCallback((check: DeliveryComplianceCheck) => {
    switch (check.check_type) {
      case 'age_verification': {
        const data = check.check_data as AgeVerificationData;
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Minimum age: {data.minimum_age}</p>
            {data.customer_age && <p>Customer age: {data.customer_age}</p>}
            {data.customer_dob && <p>DOB: {data.customer_dob}</p>}
            {data.id_type && <p>ID type: {data.id_type}</p>}
            {data.id_expiry && <p>ID expiry: {data.id_expiry}</p>}
          </div>
        );
      }
      case 'id_on_file': {
        const data = check.check_data as IdOnFileData;
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>ID on file: {data.has_id_on_file ? 'Yes' : 'No'}</p>
            {data.id_type && <p>ID type: {data.id_type}</p>}
            {data.id_verified_at && (
              <p>Verified: {format(parseISO(data.id_verified_at), 'MMM d, yyyy')}</p>
            )}
            {data.id_expiry && <p>Expiry: {data.id_expiry}</p>}
          </div>
        );
      }
      case 'licensed_zone': {
        const data = check.check_data as LicensedZoneData;
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>In licensed zone: {data.is_in_licensed_zone ? 'Yes' : 'No'}</p>
            {data.zone_name && <p>Zone: {data.zone_name}</p>}
            {data.customer_lat && data.customer_lng && (
              <p>
                Location: {data.customer_lat.toFixed(4)}, {data.customer_lng.toFixed(4)}
              </p>
            )}
          </div>
        );
      }
      case 'time_restriction': {
        const data = check.check_data as TimeRestrictionData;
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Current time: {data.delivery_time}</p>
            <p>
              Allowed hours: {data.allowed_start} - {data.allowed_end}
            </p>
            <p>Day: {data.day_of_week}</p>
            <p>Within hours: {data.is_within_hours ? 'Yes' : 'No'}</p>
          </div>
        );
      }
      case 'quantity_limit': {
        const data = check.check_data as QuantityLimitData;
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            {data.total_thc_mg !== undefined && (
              <p>
                THC: {data.total_thc_mg}mg / {data.max_allowed_mg}mg
              </p>
            )}
            {data.total_weight_g !== undefined && (
              <p>
                Weight: {data.total_weight_g}g / {data.max_allowed_weight_g}g
              </p>
            )}
            <p>Exceeds limit: {data.exceeds_limit ? 'Yes' : 'No'}</p>
          </div>
        );
      }
      case 'customer_status': {
        const data = check.check_data as CustomerStatusData;
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Status: {data.customer_status}</p>
            <p>Active: {data.is_active ? 'Yes' : 'No'}</p>
            <p>Verified: {data.is_verified ? 'Yes' : 'No'}</p>
          </div>
        );
      }
      default:
        return null;
    }
  }, []);

  // Render
  if (!isReady) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">Failed to load compliance checks</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                canCompleteDelivery ? 'bg-green-500/10' : 'bg-amber-500/10'
              )}
            >
              {canCompleteDelivery ? (
                <ShieldCheck className="h-6 w-6 text-green-600" />
              ) : (
                <Shield className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Compliance Checklist</CardTitle>
              <CardDescription>
                {canCompleteDelivery
                  ? 'All compliance requirements met'
                  : 'Complete all checks before delivery'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuditLog(!showAuditLog)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View audit log</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {passedChecks.length} of {complianceChecks.length} checks passed
            </span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {passedChecks.length > 0 && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {passedChecks.length} passed
            </Badge>
          )}
          {failedChecks.length > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600">
              <XCircle className="h-3 w-3 mr-1" />
              {failedChecks.length} failed
            </Badge>
          )}
          {pendingChecks.length > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
              <Clock className="h-3 w-3 mr-1" />
              {pendingChecks.length} pending
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Initialize checks button */}
        {complianceChecks.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
            <ShieldX className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No compliance checks initialized</p>
            <Button onClick={() => setInitializeConfirmOpen(true)} disabled={isInitializing}>
              {isInitializing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Initialize Compliance Checks
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Compliance checks list */}
        {complianceChecks.length > 0 && (
          <div className="space-y-3">
            {complianceChecks.map((check) => {
              const CheckIcon = CHECK_ICONS[check.check_type];
              const statusConfig = STATUS_CONFIG[check.status];
              const StatusIcon = statusConfig.icon;
              const isExpanded = expandedCheckId === check.id;
              const isBlockingFailed =
                check.blocks_delivery && check.status === 'failed';

              return (
                <Collapsible
                  key={check.id}
                  open={isExpanded}
                  onOpenChange={() =>
                    setExpandedCheckId(isExpanded ? null : check.id)
                  }
                >
                  <div
                    className={cn(
                      'border rounded-lg transition-colors',
                      isBlockingFailed && 'border-red-500 bg-red-50/50 dark:bg-red-950/20',
                      check.status === 'passed' && 'border-green-500/50',
                      check.status === 'override' && 'border-purple-500/50'
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'p-2 rounded-lg',
                              check.status === 'passed' && 'bg-green-500/10',
                              check.status === 'failed' && 'bg-red-500/10',
                              check.status === 'pending' && 'bg-amber-500/10',
                              check.status === 'override' && 'bg-purple-500/10',
                              check.status === 'skipped' && 'bg-gray-500/10'
                            )}
                          >
                            <CheckIcon
                              className={cn('h-5 w-5', statusConfig.color)}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {CHECK_LABELS[check.check_type]}
                            </p>
                            {check.failure_reason && (
                              <p className="text-xs text-red-500">
                                {check.failure_reason}
                              </p>
                            )}
                            {check.status === 'override' && check.override_reason && (
                              <p className="text-xs text-purple-500">
                                Override: {check.override_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'capitalize',
                              check.status === 'passed' && 'bg-green-500/10 text-green-600',
                              check.status === 'failed' && 'bg-red-500/10 text-red-600',
                              check.status === 'pending' && 'bg-amber-500/10 text-amber-600',
                              check.status === 'override' && 'bg-purple-500/10 text-purple-600'
                            )}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          {check.blocks_delivery && check.status !== 'passed' && check.status !== 'override' && (
                            <Badge variant="destructive" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Blocks
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4 space-y-4">
                        {/* Check data */}
                        {renderCheckData(check)}

                        {/* Actions */}
                        {check.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleManualVerify(check, true)}
                              disabled={isVerifying}
                            >
                              {isVerifying && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Verify Passed
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleManualVerify(check, false)}
                              disabled={isVerifying}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Mark Failed
                            </Button>
                          </div>
                        )}

                        {check.status === 'failed' && canOverride && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenOverride(check.id)}
                            >
                              <Unlock className="h-4 w-4 mr-2" />
                              Override Check
                            </Button>
                          </div>
                        )}

                        {/* Verification info */}
                        {check.verified_at && (
                          <div className="text-xs text-muted-foreground pt-2">
                            Verified:{' '}
                            {format(parseISO(check.verified_at), 'MMM d, h:mm a')} (
                            {check.verification_method})
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Blocking alert */}
        {blockingChecks.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Delivery Blocked
                </p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {blockingChecks.length} compliance check
                  {blockingChecks.length > 1 ? 's' : ''} must pass before delivery
                  can be completed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {canCompleteDelivery && complianceChecks.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Ready for Delivery
                </p>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  All compliance requirements have been met. You may proceed with
                  delivery completion.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit log */}
        {showAuditLog && (
          <>
            <Separator className="my-4" />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Compliance Audit Log</h4>
              </div>
              {isAuditLogLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries</p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {auditLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded"
                      >
                        <span className="text-muted-foreground">
                          {format(parseISO(entry.created_at), 'h:mm a')}
                        </span>
                        <span className="font-medium">{entry.action}</span>
                        {entry.actor_type && (
                          <Badge variant="outline" className="text-xs">
                            {entry.actor_type}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Compliance Check</DialogTitle>
            <DialogDescription>
              Overriding a failed compliance check requires admin approval and will
              be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={overrideForm.handleSubmit(handleOverrideSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="override_reason">Override Reason *</Label>
              <Textarea
                id="override_reason"
                placeholder="Explain why this check is being overridden..."
                rows={4}
                {...overrideForm.register('override_reason')}
              />
              {overrideForm.formState.errors.override_reason && (
                <p className="text-sm text-destructive">
                  {overrideForm.formState.errors.override_reason.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOverrideDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isOverriding}>
                {isOverriding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Override
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Initialize Confirmation Dialog */}
      <AlertDialog open={initializeConfirmOpen} onOpenChange={setInitializeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Initialize Compliance Checks</AlertDialogTitle>
            <AlertDialogDescription>
              This will create all required compliance checks for this delivery. The
              system will automatically verify checks that can be validated against
              customer and order data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInitializeChecks} disabled={isInitializing}>
              {isInitializing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Initialize Checks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default DeliveryComplianceChecklist;
