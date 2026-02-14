/**
 * CustomerBlockFlag Component
 *
 * Manages customer flags and blocks for:
 * - Flagged customers: show warning banner when creating orders
 * - Blocked customers: prevented from ordering via storefront
 *
 * Flag reasons: payment issues, compliance, fraud, abuse, other
 * Admin-only action via usePermissions.
 */

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Flag,
  ShieldBan,
  Plus,
  CheckCircle,
  AlertTriangle,
  Ban,
  CreditCard,
  FileWarning,
  UserX,
  AlertCircle,
  History,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  useCustomerFlags,
  FLAG_REASON_LABELS,
  FLAG_TYPE_LABELS,
  type FlagType,
  type FlagReason,
  type CustomerFlag,
} from '@/hooks/useCustomerFlags';
import { usePermissions } from '@/hooks/usePermissions';

interface CustomerBlockFlagProps {
  customerId: string;
  customerName?: string;
  className?: string;
}

// Flag reason icons
const FLAG_REASON_ICONS: Record<FlagReason, typeof AlertCircle> = {
  payment_issues: CreditCard,
  compliance: FileWarning,
  fraud: ShieldBan,
  abuse: UserX,
  other: AlertCircle,
};

// Flag type colors
const FLAG_TYPE_COLORS: Record<FlagType, string> = {
  flagged: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  blocked: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
};

export function CustomerBlockFlag({ customerId, customerName, className }: CustomerBlockFlagProps) {
  const { canEdit } = usePermissions();
  const canManageFlags = canEdit('customers');

  const {
    status,
    flags,
    flagHistory,
    isLoading,
    isLoadingHistory,
    error,
    addFlag,
    resolveFlag,
    isAddingFlag,
    isResolvingFlag,
  } = useCustomerFlags(customerId);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState<CustomerFlag | null>(null);
  const [selectedFlagType, setSelectedFlagType] = useState<FlagType>('flagged');
  const [selectedReason, setSelectedReason] = useState<FlagReason>('payment_issues');
  const [reasonDetails, setReasonDetails] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Handlers
  const handleAddFlag = async () => {
    const result = await addFlag({
      customerId,
      flagType: selectedFlagType,
      flagReason: selectedReason,
      reasonDetails: reasonDetails.trim() || undefined,
    });

    if (result) {
      toast.success(
        selectedFlagType === 'blocked'
          ? `${customerName || 'Customer'} has been blocked`
          : `${customerName || 'Customer'} has been flagged`
      );
      setShowAddDialog(false);
      resetForm();
    } else {
      toast.error('Failed to add flag');
    }
  };

  const handleResolveFlag = async () => {
    if (!showResolveDialog) return;

    const result = await resolveFlag({
      flagId: showResolveDialog.id,
      resolutionNotes: resolutionNotes.trim() || undefined,
    });

    if (result) {
      toast.success('Flag has been resolved');
      setShowResolveDialog(null);
      setResolutionNotes('');
    } else {
      toast.error('Failed to resolve flag');
    }
  };

  const resetForm = () => {
    setSelectedFlagType('flagged');
    setSelectedReason('payment_issues');
    setReasonDetails('');
  };

  // Render flag item
  const renderFlagItem = (flag: CustomerFlag, showResolve = true) => {
    const ReasonIcon = FLAG_REASON_ICONS[flag.flag_reason];
    const isActive = flag.is_active;

    return (
      <div
        key={flag.id}
        className={cn(
          'p-4 rounded-lg border transition-all',
          isActive
            ? FLAG_TYPE_COLORS[flag.flag_type]
            : 'bg-muted/50 border-muted opacity-60'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-full',
              flag.flag_type === 'blocked' ? 'bg-red-200 dark:bg-red-900/50' : 'bg-amber-200 dark:bg-amber-900/50'
            )}>
              {flag.flag_type === 'blocked' ? (
                <Ban className="h-4 w-4 text-red-700 dark:text-red-400" />
              ) : (
                <Flag className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-medium',
                    isActive && FLAG_TYPE_COLORS[flag.flag_type]
                  )}
                >
                  {FLAG_TYPE_LABELS[flag.flag_type]}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <ReasonIcon className="h-3 w-3 mr-1" />
                  {FLAG_REASON_LABELS[flag.flag_reason]}
                </Badge>
                {!isActive && (
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>
              {flag.reason_details && (
                <p className="text-sm mt-2">{flag.reason_details}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Added {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                {' · '}
                {format(new Date(flag.created_at), 'MMM d, yyyy h:mm a')}
              </p>
              {flag.resolved_at && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Resolved {formatDistanceToNow(new Date(flag.resolved_at), { addSuffix: true })}
                  {flag.resolution_notes && `: ${flag.resolution_notes}`}
                </p>
              )}
            </div>
          </div>

          {showResolve && isActive && canManageFlags && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolveDialog(flag)}
              disabled={isResolvingFlag}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ShieldBan className="h-5 w-5" />
            Flags & Blocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load flag information. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ShieldBan className="h-5 w-5" />
            Flags & Blocks
            {status.activeFlags.length > 0 && (
              <Badge
                variant="destructive"
                className={cn(
                  'ml-1',
                  status.isBlocked
                    ? 'bg-red-600'
                    : 'bg-amber-500'
                )}
              >
                {status.activeFlags.length}
              </Badge>
            )}
          </CardTitle>
          {canManageFlags && (
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Flag
            </Button>
          )}
        </div>

        {/* Status Banner */}
        {(status.isFlagged || status.isBlocked) && (
          <div
            className={cn(
              'mt-3 p-3 rounded-lg flex items-center gap-3',
              status.isBlocked
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
            )}
          >
            {status.isBlocked ? (
              <>
                <Ban className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Customer is Blocked</p>
                  <p className="text-sm opacity-90">
                    This customer cannot place orders via storefront.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Customer is Flagged</p>
                  <p className="text-sm opacity-90">
                    Review the flags below before creating orders.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              Active
              {status.activeFlags.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {status.activeFlags.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {flags.length === 0 ? (
              <EnhancedEmptyState
                icon={CheckCircle}
                title="No Active Flags"
                description="This customer has no active flags or blocks."
                primaryAction={canManageFlags ? {
                  label: 'Add Flag',
                  onClick: () => setShowAddDialog(true),
                } : undefined}
                compact
              />
            ) : (
              flags.map((flag) => renderFlagItem(flag))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {isLoadingHistory ? (
              <Skeleton className="h-20 w-full" />
            ) : flagHistory.length === 0 ? (
              <EnhancedEmptyState
                icon={History}
                title="No Flag History"
                description="No flags have been recorded for this customer."
                compact
              />
            ) : (
              flagHistory.map((flag) => renderFlagItem(flag, false))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Add Flag Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Add Flag or Block
            </DialogTitle>
            <DialogDescription>
              Flag this customer with a warning or block them from ordering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Flag Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Flag Type</label>
              <Select
                value={selectedFlagType}
                onValueChange={(v) => setSelectedFlagType(v as FlagType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flagged">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-amber-600" />
                      <span>Flag (Warning Only)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="blocked">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-red-600" />
                      <span>Block (Prevent Ordering)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedFlagType === 'blocked'
                  ? 'Blocked customers cannot place orders through storefront.'
                  : 'Flagged customers will show a warning when creating orders.'}
              </p>
            </div>

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Select
                value={selectedReason}
                onValueChange={(v) => setSelectedReason(v as FlagReason)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FLAG_REASON_LABELS) as [FlagReason, string][]).map(([key, label]) => {
                    const Icon = FLAG_REASON_ICONS[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Details (Optional)</label>
              <Textarea
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Provide more context about this flag..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddFlag}
              disabled={isAddingFlag}
              className={cn(
                selectedFlagType === 'blocked'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              )}
            >
              {isAddingFlag ? 'Adding...' : selectedFlagType === 'blocked' ? 'Block Customer' : 'Flag Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Flag Dialog */}
      <AlertDialog
        open={!!showResolveDialog}
        onOpenChange={() => setShowResolveDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Flag</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the flag as resolved. The customer will no longer be{' '}
              {showResolveDialog?.flag_type === 'blocked' ? 'blocked from ordering' : 'flagged'}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium">Resolution Notes (Optional)</label>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Add notes about why this flag was resolved..."
              rows={3}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResolutionNotes('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResolveFlag}
              disabled={isResolvingFlag}
              className="bg-green-600 hover:bg-green-700"
            >
              {isResolvingFlag ? 'Resolving...' : 'Resolve Flag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
