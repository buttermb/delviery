/**
 * Vendor Compliance Tracking Component
 *
 * Tracks vendor compliance for cannabis vendors.
 * Features:
 * - License management (number, type, expiration, jurisdiction)
 * - Approved product categories
 * - License expiration warnings (red badge when approaching)
 * - Block PO creation for expired licenses
 * - Required compliance docs upload
 * - Audit trail for compliance changes
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, formatDistanceToNow } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Shield,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  History,
  Calendar,
  MapPin,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';

import { humanizeError } from '@/lib/humanizeError';
import {
  useVendorCompliance,
  useVendorComplianceAudit,
  LICENSE_TYPE_OPTIONS,
  COMMON_PRODUCT_CATEGORIES,
  getComplianceStatus,
  getDaysUntilExpiration,
  type VendorCompliance,
  type LicenseType,
  type ComplianceStatus,
} from '@/hooks/useVendorCompliance';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

// ============================================================================
// Types & Schema
// ============================================================================

interface VendorComplianceTrackingProps {
  vendorId: string;
  vendorName: string;
  onComplianceStatusChange?: (status: ComplianceStatus, canCreatePO: boolean) => void;
}

const complianceFormSchema = z.object({
  license_number: z.string().min(1, 'License number is required'),
  license_type: z.string().min(1, 'License type is required'),
  license_expiration: z.string().optional(),
  jurisdiction: z.string().optional(),
  approved_categories: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
});

type ComplianceFormValues = z.infer<typeof complianceFormSchema>;

// ============================================================================
// Status Badge Component
// ============================================================================

function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  const config = {
    compliant: {
      variant: 'default' as const,
      icon: CheckCircle,
      label: 'Compliant',
      className: 'bg-green-500 hover:bg-green-600',
    },
    warning: {
      variant: 'default' as const,
      icon: AlertTriangle,
      label: 'Expiring Soon',
      className: 'bg-yellow-500 hover:bg-yellow-600',
    },
    expired: {
      variant: 'destructive' as const,
      icon: XCircle,
      label: 'Expired',
      className: '',
    },
    pending: {
      variant: 'secondary' as const,
      icon: Clock,
      label: 'Pending Setup',
      className: '',
    },
  };

  const { variant, icon: Icon, label, className } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VendorComplianceTracking({
  vendorId,
  vendorName,
  onComplianceStatusChange,
}: VendorComplianceTrackingProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false);
  const [editingCompliance, setEditingCompliance] = useState<VendorCompliance | null>(null);
  const [deleteComplianceId, setDeleteComplianceId] = useState<string | null>(null);
  const [selectedComplianceForAudit, setSelectedComplianceForAudit] = useState<string | null>(null);

  const {
    complianceRecords,
    activeCompliance,
    complianceStatus,
    isExpired,
    isWarning,
    isLoading,
    isError,
    createCompliance,
    updateCompliance,
    deleteCompliance,
    isCreating,
    isUpdating,
    isDeleting,
  } = useVendorCompliance(vendorId);

  const form = useForm<ComplianceFormValues>({
    resolver: zodResolver(complianceFormSchema),
    defaultValues: {
      license_number: '',
      license_type: '',
      license_expiration: '',
      jurisdiction: '',
      approved_categories: [],
      is_active: true,
      notes: '',
    },
  });

  // Notify parent of compliance status changes
  const canCreatePO = !isExpired;
  if (onComplianceStatusChange) {
    onComplianceStatusChange(complianceStatus, canCreatePO);
  }

  // Handle dialog open for create
  const handleAddCompliance = useCallback(() => {
    setEditingCompliance(null);
    form.reset({
      license_number: '',
      license_type: '',
      license_expiration: '',
      jurisdiction: '',
      approved_categories: [],
      is_active: true,
      notes: '',
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle dialog open for edit
  const handleEditCompliance = useCallback(
    (compliance: VendorCompliance) => {
      setEditingCompliance(compliance);
      form.reset({
        license_number: compliance.license_number,
        license_type: compliance.license_type,
        license_expiration: compliance.license_expiration ?? '',
        jurisdiction: compliance.jurisdiction ?? '',
        approved_categories: compliance.approved_categories ?? [],
        is_active: compliance.is_active,
        notes: compliance.notes ?? '',
      });
      setIsDialogOpen(true);
    },
    [form]
  );

  // Handle form submit
  const handleSubmit = async (values: ComplianceFormValues) => {
    try {
      if (editingCompliance) {
        await updateCompliance({
          id: editingCompliance.id,
          license_number: values.license_number,
          license_type: values.license_type as LicenseType,
          license_expiration: values.license_expiration || null,
          jurisdiction: values.jurisdiction || null,
          approved_categories: values.approved_categories,
          is_active: values.is_active,
          notes: values.notes || null,
        });
        toast.success('Compliance record updated');
      } else {
        await createCompliance({
          vendor_id: vendorId,
          license_number: values.license_number,
          license_type: values.license_type as LicenseType,
          license_expiration: values.license_expiration || undefined,
          jurisdiction: values.jurisdiction || undefined,
          approved_categories: values.approved_categories,
          is_active: values.is_active,
          notes: values.notes || undefined,
        });
        toast.success('Compliance record created');
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      logger.error('Failed to save compliance', error, {
        component: 'VendorComplianceTracking',
      });
      toast.error(
        editingCompliance
          ? 'Failed to update compliance record'
          : 'Failed to create compliance record'
      );
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteComplianceId) return;
    try {
      await deleteCompliance(deleteComplianceId);
      toast.success('Compliance record deleted');
      setDeleteComplianceId(null);
    } catch (error) {
      logger.error('Failed to delete compliance', error, {
        component: 'VendorComplianceTracking',
      });
      toast.error('Failed to delete compliance record', { description: humanizeError(error) });
    }
  };

  // Handle view audit
  const handleViewAudit = (complianceId: string) => {
    setSelectedComplianceForAudit(complianceId);
    setIsAuditDialogOpen(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <EnhancedEmptyState
            icon={Shield}
            title="Failed to load compliance"
            description="There was an error loading vendor compliance data. Please try again."
            primaryAction={{
              label: 'Retry',
              onClick: () => window.location.reload(),
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance Tracking
            </CardTitle>
            <CardDescription>
              Manage licenses and compliance for {vendorName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ComplianceStatusBadge status={complianceStatus} />
            <Button onClick={handleAddCompliance} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add License
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Warning Banner for Expired/Expiring Licenses */}
          {(isExpired || isWarning) && activeCompliance && (
            <div
              className={`mb-4 rounded-lg border p-4 ${
                isExpired
                  ? 'border-destructive bg-destructive/10'
                  : 'border-yellow-500 bg-yellow-500/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`h-5 w-5 ${
                    isExpired ? 'text-destructive' : 'text-yellow-600'
                  }`}
                />
                <div>
                  <h4 className="font-medium">
                    {isExpired ? 'License Expired' : 'License Expiring Soon'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {isExpired
                      ? 'Purchase orders cannot be created for this vendor until the license is renewed.'
                      : `License expires ${formatDistanceToNow(
                          new Date(activeCompliance.license_expiration!),
                          { addSuffix: true }
                        )}. Please renew before expiration.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {complianceRecords.length === 0 ? (
            <EnhancedEmptyState
              icon={Shield}
              title="No compliance records"
              description="Add license information to track compliance for this vendor."
              primaryAction={{
                label: 'Add License',
                onClick: handleAddCompliance,
              }}
            />
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {complianceRecords.map((compliance) => {
                const status = getComplianceStatus(compliance);
                const daysRemaining = getDaysUntilExpiration(
                  compliance.license_expiration
                );

                return (
                  <AccordionItem
                    key={compliance.id}
                    value={compliance.id}
                    className="border rounded-lg mb-2 px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {compliance.license_number}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {LICENSE_TYPE_OPTIONS.find(
                                (t) => t.value === compliance.license_type
                              )?.label ?? compliance.license_type}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ComplianceStatusBadge status={status} />
                          {!compliance.is_active && (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2">
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* License Details */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            License Details
                          </h4>
                          {compliance.license_expiration && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Expires:
                              </span>
                              <span
                                className={
                                  status === 'expired'
                                    ? 'text-destructive font-medium'
                                    : status === 'warning'
                                    ? 'text-yellow-600 font-medium'
                                    : ''
                                }
                              >
                                {format(
                                  new Date(compliance.license_expiration),
                                  'MMM d, yyyy'
                                )}
                                {daysRemaining !== null && (
                                  <span className="ml-1">
                                    ({daysRemaining > 0 ? `${daysRemaining} days` : 'Expired'})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          {compliance.jurisdiction && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Jurisdiction:
                              </span>
                              <span>{compliance.jurisdiction}</span>
                            </div>
                          )}
                        </div>

                        {/* Approved Categories */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Approved Categories
                          </h4>
                          {compliance.approved_categories &&
                          compliance.approved_categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {compliance.approved_categories.map((cat) => (
                                <Badge
                                  key={cat}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  <Tag className="mr-1 h-3 w-3" />
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              All categories
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {compliance.notes && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Notes
                          </h4>
                          <p className="text-sm whitespace-pre-wrap">
                            {compliance.notes}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-4 pt-4 border-t flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Last updated:{' '}
                          {format(
                            new Date(compliance.updated_at),
                            'MMM d, yyyy h:mm a'
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewAudit(compliance.id)}
                          >
                            <History className="mr-1 h-4 w-4" />
                            Audit Log
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCompliance(compliance)}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteComplianceId(compliance.id)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Compliance Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompliance ? 'Edit License' : 'Add License'}
            </DialogTitle>
            <DialogDescription>
              {editingCompliance
                ? 'Update license and compliance information.'
                : 'Add a new license record for this vendor.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="license_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>License Number</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC-123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="license_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>License Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select license type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LICENSE_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="license_expiration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jurisdiction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jurisdiction</FormLabel>
                      <FormControl>
                        <Input placeholder="CA, CO, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="approved_categories"
                render={() => (
                  <FormItem>
                    <FormLabel>Approved Product Categories</FormLabel>
                    <FormDescription>
                      Select categories this license allows. Leave empty for all
                      categories.
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {COMMON_PRODUCT_CATEGORIES.map((category) => (
                        <FormField
                          key={category}
                          control={form.control}
                          name="approved_categories"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(category)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value ?? []), category]
                                      : field.value?.filter(
                                          (v) => v !== category
                                        ) ?? [];
                                    field.onChange(newValue);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                {category}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      License is active
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this license..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {(isCreating || isUpdating) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingCompliance ? 'Save Changes' : 'Add License'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <AuditLogDialog
        complianceId={selectedComplianceForAudit}
        isOpen={isAuditDialogOpen}
        onClose={() => {
          setIsAuditDialogOpen(false);
          setSelectedComplianceForAudit(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteComplianceId}
        onOpenChange={() => setDeleteComplianceId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete License Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this compliance record? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Audit Log Dialog Component
// ============================================================================

interface AuditLogDialogProps {
  complianceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function AuditLogDialog({ complianceId, isOpen, onClose }: AuditLogDialogProps) {
  const { data: auditLog, isLoading } = useVendorComplianceAudit(
    complianceId ?? ''
  );

  if (!complianceId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Compliance Audit Log
          </DialogTitle>
          <DialogDescription>
            View the history of changes to this compliance record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !auditLog || auditLog.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No audit history available.
            </p>
          ) : (
            <div className="space-y-3">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        new Date(entry.performed_at),
                        'MMM d, yyyy h:mm a'
                      )}
                    </span>
                  </div>
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="text-sm space-y-1">
                      {Object.entries(entry.changes).map(([field, change]) => {
                        const changeObj = change as { from?: unknown; to?: unknown };
                        return (
                          <div key={field} className="text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {field.replace(/_/g, ' ')}:
                            </span>{' '}
                            {changeObj.from !== undefined && (
                              <>
                                <span className="line-through">
                                  {String(changeObj.from || 'empty')}
                                </span>
                                {' → '}
                              </>
                            )}
                            <span>{String(changeObj.to || 'empty')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
