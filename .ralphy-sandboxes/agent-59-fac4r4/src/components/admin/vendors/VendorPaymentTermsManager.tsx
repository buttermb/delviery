/**
 * Vendor Payment Terms Manager Component
 *
 * Manages payment terms per vendor (net 15/30/60, COD, prepaid).
 * Features:
 * - Store payment terms configuration
 * - Display current payment terms
 * - Auto-calculate due dates for POs
 * - Payment term compliance tracking
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  CreditCard,
  Loader2,
  Edit,
  Clock,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useVendorPaymentTerms,
  PAYMENT_TERM_OPTIONS,
  getPaymentTermDays,
  type PaymentTermType,
} from '@/hooks/useVendorPaymentTerms';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

// ============================================================================
// Types & Schema
// ============================================================================

interface VendorPaymentTermsManagerProps {
  vendorId: string;
  vendorName: string;
}

const paymentTermsFormSchema = z.object({
  payment_term_type: z.string().min(1, 'Payment terms are required'),
  custom_days: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

type PaymentTermsFormValues = z.infer<typeof paymentTermsFormSchema>;

// ============================================================================
// Helper Components
// ============================================================================

function PaymentTermBadge({ termType, customDays }: { termType: PaymentTermType; customDays?: number | null }) {
  const days = getPaymentTermDays(termType, customDays);

  let variant: 'default' | 'secondary' | 'outline' = 'default';
  let colorClass = '';

  if (termType === 'cod' || termType === 'prepaid') {
    variant = 'secondary';
    colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (days <= 15) {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
  } else if (days <= 30) {
    colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  } else if (days <= 60) {
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
  } else {
    colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
  }

  const label = termType === 'custom' && customDays
    ? `Net ${customDays}`
    : PAYMENT_TERM_OPTIONS.find(o => o.value === termType)?.label ?? termType;

  return (
    <Badge variant={variant} className={colorClass}>
      <Clock className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VendorPaymentTermsManager({
  vendorId,
  vendorName,
}: VendorPaymentTermsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const {
    paymentTerms,
    termsLabel,
    isLoading,
    isError,
    upsertTerms,
    isUpserting,
  } = useVendorPaymentTerms(vendorId);

  const form = useForm<PaymentTermsFormValues>({
    resolver: zodResolver(paymentTermsFormSchema),
    defaultValues: {
      payment_term_type: paymentTerms?.payment_term_type ?? 'net_30',
      custom_days: paymentTerms?.custom_days ?? undefined,
      notes: paymentTerms?.notes ?? '',
    },
  });

  // Watch for custom term type to show/hide custom days field
  const selectedTermType = form.watch('payment_term_type');
  const showCustomDays = selectedTermType === 'custom';

  // Handle dialog open for edit
  const handleEditTerms = useCallback(() => {
    form.reset({
      payment_term_type: paymentTerms?.payment_term_type ?? 'net_30',
      custom_days: paymentTerms?.custom_days ?? undefined,
      notes: paymentTerms?.notes ?? '',
    });
    setIsDialogOpen(true);
  }, [form, paymentTerms]);

  // Handle form submit
  const handleSubmit = async (values: PaymentTermsFormValues) => {
    try {
      await upsertTerms({
        vendor_id: vendorId,
        payment_term_type: values.payment_term_type as PaymentTermType,
        custom_days: values.payment_term_type === 'custom' ? values.custom_days : undefined,
        notes: values.notes || undefined,
      });
      toast.success('Payment terms saved');
      setIsDialogOpen(false);
    } catch (error) {
      logger.error('Failed to save payment terms', error, {
        component: 'VendorPaymentTermsManager',
        vendorId,
      });
      toast.error('Failed to save payment terms');
    }
  };

  // Get days for display
  const paymentDays = paymentTerms
    ? getPaymentTermDays(paymentTerms.payment_term_type, paymentTerms.custom_days)
    : 30;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            icon={CreditCard}
            title="Failed to load payment terms"
            description="There was an error loading payment terms. Please try again."
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
              <CreditCard className="h-5 w-5" />
              Payment Terms
            </CardTitle>
            <CardDescription>
              Configure payment terms for {vendorName}
            </CardDescription>
          </div>
          <Button onClick={handleEditTerms} variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            {paymentTerms ? 'Edit' : 'Set Terms'}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Current Terms Display */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Payment Terms</span>
              </div>
              <div className="flex items-center gap-2">
                {paymentTerms ? (
                  <PaymentTermBadge
                    termType={paymentTerms.payment_term_type}
                    customDays={paymentTerms.custom_days}
                  />
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Net 30 (Default)
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Days Until Due</span>
              </div>
              <div className="text-2xl font-semibold">
                {paymentDays === 0 ? (
                  <span className="text-blue-600">Due on delivery</span>
                ) : paymentDays < 0 ? (
                  <span className="text-blue-600">Prepaid</span>
                ) : (
                  <span>{paymentDays} days</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Term Type</span>
              </div>
              <div className="flex items-center gap-2">
                {paymentTerms?.payment_term_type === 'cod' || paymentTerms?.payment_term_type === 'prepaid' ? (
                  <div className="flex items-center gap-1 text-blue-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">
                      {paymentTerms.payment_term_type === 'cod' ? 'Cash Required' : 'Prepayment Required'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Net Terms</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {paymentTerms?.notes && (
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{paymentTerms.notes}</p>
            </div>
          )}

          {/* Last Updated */}
          {paymentTerms && (
            <div className="mt-4 text-xs text-muted-foreground">
              Last updated: {format(new Date(paymentTerms.updated_at), 'MMM d, yyyy h:mm a')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Payment Terms Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentTerms ? 'Edit Payment Terms' : 'Set Payment Terms'}
            </DialogTitle>
            <DialogDescription>
              Configure payment terms for {vendorName}. This will apply to all new purchase orders.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="payment_term_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TERM_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How long after receiving goods before payment is due.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showCustomDays && (
                <FormField
                  control={form.control}
                  name="custom_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Days *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g., 45"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of days until payment is due.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about payment terms..."
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
                <Button type="submit" disabled={isUpserting}>
                  {isUpserting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Terms
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
