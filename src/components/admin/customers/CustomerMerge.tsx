/**
 * CustomerMerge Component
 *
 * Merge duplicate customer records. Select primary record, merge secondary into it.
 * Combines order history, payment history, notes, tags. Deduplicates addresses.
 * Updates all order references to point to primary customer. Logs merge to activity_log.
 * Shows preview before merge.
 */

import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import {
  Users,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  X,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  MapPin,
  Tag,
  ChevronRight,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ScrollArea } from '@/components/ui/scroll-area';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { formatSmartDate, formatPhoneNumber } from '@/lib/formatters';

interface CustomerMergeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCustomerId?: string;
  onMergeComplete?: (primaryCustomerId: string) => void;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  total_spent: number;
  loyalty_points: number;
  created_at: string;
}

interface MergePreviewData {
  ordersCount: number;
  paymentsCount: number;
  notesCount: number;
  tagsCount: number;
  addressesCount: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return formatSmartDate(dateString);
}

export function CustomerMerge({
  open,
  onOpenChange,
  preselectedCustomerId,
  onMergeComplete,
}: CustomerMergeProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();

  // State
  const [primaryCustomer, setPrimaryCustomer] = useState<Customer | null>(null);
  const [secondaryCustomer, setSecondaryCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectingFor, setSelectingFor] = useState<'primary' | 'secondary' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');

  // Search customers query
  const {
    data: searchResults,
    isLoading: searchLoading,
  } = useQuery({
    queryKey: ['customer-search', searchQuery, tenantId],
    queryFn: async () => {
      if (!tenantId || !searchQuery.trim()) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, address, city, state, zip_code, total_spent, loyalty_points, created_at')
        .eq('tenant_id', tenantId)
        .or(`first_name.ilike.%${escapePostgresLike(searchQuery)}%,last_name.ilike.%${escapePostgresLike(searchQuery)}%,email.ilike.%${escapePostgresLike(searchQuery)}%,phone.ilike.%${escapePostgresLike(searchQuery)}%`)
        .limit(10);

      if (error) {
        logger.error('Failed to search customers for merge', error, { tenantId });
        throw error;
      }

      return data as Customer[];
    },
    enabled: !!tenantId && searchQuery.trim().length > 1,
  });

  // Fetch merge preview data for secondary customer
  const {
    data: previewData,
    isLoading: previewLoading,
  } = useQuery({
    queryKey: ['customer-merge-preview', secondaryCustomer?.id, tenantId],
    queryFn: async () => {
      if (!tenantId || !secondaryCustomer?.id) return null;

      const [ordersResult, paymentsResult, notesResult, tagsResult, addressesResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', secondaryCustomer.id)
          .eq('tenant_id', tenantId),
        (supabase as any)
          .from('customer_payments')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', secondaryCustomer.id)
          .eq('tenant_id', tenantId),
        (supabase as any)
          .from('customer_notes')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', secondaryCustomer.id)
          .eq('tenant_id', tenantId),
        (supabase as any)
          .from('customer_tags')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', secondaryCustomer.id)
          .eq('tenant_id', tenantId),
        (supabase as any)
          .from('customer_delivery_addresses')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', secondaryCustomer.id)
          .eq('tenant_id', tenantId),
      ]);

      return {
        ordersCount: ordersResult.count || 0,
        paymentsCount: paymentsResult.count || 0,
        notesCount: notesResult.count || 0,
        tagsCount: tagsResult.count || 0,
        addressesCount: addressesResult.count || 0,
      } as MergePreviewData;
    },
    enabled: !!tenantId && !!secondaryCustomer?.id,
  });

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !primaryCustomer || !secondaryCustomer) {
        throw new Error('Missing required data for merge');
      }

      logger.info('Starting customer merge', {
        primaryId: primaryCustomer.id,
        secondaryId: secondaryCustomer.id,
        tenantId,
      });

      // 1. Update orders to point to primary customer
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ customer_id: primaryCustomer.id })
        .eq('customer_id', secondaryCustomer.id)
        .eq('tenant_id', tenantId);

      if (ordersError) {
        logger.error('Failed to update orders during merge', ordersError);
        throw ordersError;
      }

      // 2. Update customer_payments to point to primary customer
      const { error: paymentsError } = await (supabase as any)
        .from('customer_payments')
        .update({ customer_id: primaryCustomer.id })
        .eq('customer_id', secondaryCustomer.id)
        .eq('tenant_id', tenantId);

      if (paymentsError) {
        logger.error('Failed to update payments during merge', paymentsError);
        throw paymentsError;
      }

      // 3. Update customer_notes to point to primary customer
      const { error: notesError } = await (supabase as any)
        .from('customer_notes')
        .update({ customer_id: primaryCustomer.id })
        .eq('customer_id', secondaryCustomer.id)
        .eq('tenant_id', tenantId);

      if (notesError) {
        logger.error('Failed to update notes during merge', notesError);
        throw notesError;
      }

      // 4. Handle customer_tags - fetch existing tags for both customers
      const { data: primaryTags } = await (supabase as any)
        .from('customer_tags')
        .select('tag_id')
        .eq('customer_id', primaryCustomer.id)
        .eq('tenant_id', tenantId);

      const primaryTagIds = new Set((primaryTags || []).map(t => t.tag_id));

      const { data: secondaryTags } = await (supabase as any)
        .from('customer_tags')
        .select('id, tag_id')
        .eq('customer_id', secondaryCustomer.id)
        .eq('tenant_id', tenantId);

      // Only transfer tags that primary doesn't already have
      for (const tag of (secondaryTags || [])) {
        if (!primaryTagIds.has(tag.tag_id)) {
          await (supabase as any)
            .from('customer_tags')
            .update({ customer_id: primaryCustomer.id })
            .eq('id', tag.id)
            .eq('tenant_id', tenantId);
        } else {
          // Delete duplicate tag
          await (supabase as any)
            .from('customer_tags')
            .delete()
            .eq('id', tag.id)
            .eq('tenant_id', tenantId);
        }
      }

      // 5. Handle delivery addresses - deduplicate based on address string
      const { data: primaryAddresses } = await (supabase as any)
        .from('customer_delivery_addresses')
        .select('address_line_1, city, state, postal_code')
        .eq('customer_id', primaryCustomer.id)
        .eq('tenant_id', tenantId);

      const existingAddresses = new Set(
        (primaryAddresses || []).map(a =>
          `${a.address_line_1?.toLowerCase()}-${a.city?.toLowerCase()}-${a.state?.toLowerCase()}-${a.postal_code?.toLowerCase()}`
        )
      );

      const { data: secondaryAddresses } = await (supabase as any)
        .from('customer_delivery_addresses')
        .select('id, address_line_1, city, state, postal_code')
        .eq('customer_id', secondaryCustomer.id)
        .eq('tenant_id', tenantId);

      for (const addr of (secondaryAddresses || [])) {
        const addrKey = `${addr.address_line_1?.toLowerCase()}-${addr.city?.toLowerCase()}-${addr.state?.toLowerCase()}-${addr.postal_code?.toLowerCase()}`;
        if (!existingAddresses.has(addrKey)) {
          await (supabase as any)
            .from('customer_delivery_addresses')
            .update({ customer_id: primaryCustomer.id })
            .eq('id', addr.id)
            .eq('tenant_id', tenantId);
        } else {
          // Delete duplicate address
          await (supabase as any)
            .from('customer_delivery_addresses')
            .delete()
            .eq('id', addr.id)
            .eq('tenant_id', tenantId);
        }
      }

      // 6. Update primary customer's total_spent and loyalty_points
      const newTotalSpent = (primaryCustomer.total_spent || 0) + (secondaryCustomer.total_spent || 0);
      const newLoyaltyPoints = (primaryCustomer.loyalty_points || 0) + (secondaryCustomer.loyalty_points || 0);

      const { error: updatePrimaryError } = await supabase
        .from('customers')
        .update({
          total_spent: newTotalSpent,
          loyalty_points: newLoyaltyPoints,
        })
        .eq('id', primaryCustomer.id)
        .eq('tenant_id', tenantId);

      if (updatePrimaryError) {
        logger.error('Failed to update primary customer during merge', updatePrimaryError);
        throw updatePrimaryError;
      }

      // 7. Delete the secondary customer record
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', secondaryCustomer.id)
        .eq('tenant_id', tenantId);

      if (deleteError) {
        logger.error('Failed to delete secondary customer during merge', deleteError);
        throw deleteError;
      }

      // 8. Log the merge action to activity_log
      await logActivity(
        'merged',
        'customer',
        primaryCustomer.id,
        {
          action: 'customer_merge',
          primaryCustomerId: primaryCustomer.id,
          primaryCustomerName: `${primaryCustomer.first_name} ${primaryCustomer.last_name}`,
          secondaryCustomerId: secondaryCustomer.id,
          secondaryCustomerName: `${secondaryCustomer.first_name} ${secondaryCustomer.last_name}`,
          mergedData: previewData,
          performedBy: admin?.userId,
        }
      );

      logger.info('Customer merge completed successfully', {
        primaryId: primaryCustomer.id,
        secondaryId: secondaryCustomer.id,
      });

      return primaryCustomer.id;
    },
    onSuccess: (primaryId) => {
      toast.success('Customers merged successfully');

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: ['customer', primaryId] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders', primaryId] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments', primaryId] });

      // Reset state and close dialog
      handleClose();
      onMergeComplete?.(primaryId);
    },
    onError: (error) => {
      logger.error('Customer merge failed', error);
      toast.error('Failed to merge customers. Please try again.');
    },
  });

  const handleSelectCustomer = useCallback((customer: Customer) => {
    if (selectingFor === 'primary') {
      // Don't allow selecting same customer as secondary
      if (secondaryCustomer?.id === customer.id) {
        toast.error('Cannot select the same customer as both primary and secondary');
        return;
      }
      setPrimaryCustomer(customer);
    } else if (selectingFor === 'secondary') {
      // Don't allow selecting same customer as primary
      if (primaryCustomer?.id === customer.id) {
        toast.error('Cannot select the same customer as both primary and secondary');
        return;
      }
      setSecondaryCustomer(customer);
    }
    setSelectingFor(null);
    setSearchQuery('');
  }, [selectingFor, primaryCustomer, secondaryCustomer]);

  const handleClose = useCallback(() => {
    setPrimaryCustomer(null);
    setSecondaryCustomer(null);
    setSearchQuery('');
    setSelectingFor(null);
    setShowConfirmDialog(false);
    setStep('select');
    onOpenChange(false);
  }, [onOpenChange]);

  const canProceedToPreview = primaryCustomer && secondaryCustomer;

  const renderCustomerCard = (
    customer: Customer | null,
    type: 'primary' | 'secondary',
    onSelect: () => void,
    onClear?: () => void
  ) => {
    if (!customer) {
      return (
        <Card
          className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onSelect}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px] text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Select {type === 'primary' ? 'Primary' : 'Secondary'} Customer</p>
            <p className="text-xs text-muted-foreground mt-1">
              {type === 'primary'
                ? 'This record will be kept'
                : 'This record will be merged and deleted'}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={type === 'primary' ? 'border-primary/50' : 'border-destructive/50'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge variant={type === 'primary' ? 'default' : 'destructive'}>
              {type === 'primary' ? 'Primary (Keep)' : 'Secondary (Delete)'}
            </Badge>
            {onClear && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CardTitle className="text-lg">
            {customer.first_name} {customer.last_name}
          </CardTitle>
          <CardDescription>
            {customer.email || formatPhoneNumber(customer.phone, { fallback: '' }) || 'No contact info'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Spent:</span>
            <span className="font-medium">{formatCurrency(customer.total_spent || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loyalty Points:</span>
            <span className="font-medium">{customer.loyalty_points || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{formatDate(customer.created_at)}</span>
          </div>
          {customer.address && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address:</span>
              <span className="text-right truncate max-w-[150px]">
                {customer.city}, {customer.state}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPreviewStep = () => {
    if (!primaryCustomer || !secondaryCustomer) return null;

    return (
      <div className="space-y-6">
        {/* Selected customers summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderCustomerCard(primaryCustomer, 'primary', () => {}, undefined)}
          {renderCustomerCard(secondaryCustomer, 'secondary', () => {}, undefined)}
        </div>

        <Separator />

        {/* Merge preview */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            What will be merged
          </h3>

          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : previewData ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-4 text-center">
                <ShoppingBag className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{previewData.ordersCount}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </Card>
              <Card className="p-4 text-center">
                <CreditCard className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold">{previewData.paymentsCount}</p>
                <p className="text-xs text-muted-foreground">Payments</p>
              </Card>
              <Card className="p-4 text-center">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{previewData.notesCount}</p>
                <p className="text-xs text-muted-foreground">Notes</p>
              </Card>
              <Card className="p-4 text-center">
                <Tag className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{previewData.tagsCount}</p>
                <p className="text-xs text-muted-foreground">Tags</p>
              </Card>
              <Card className="p-4 text-center">
                <MapPin className="h-6 w-6 mx-auto mb-2 text-rose-500" />
                <p className="text-2xl font-bold">{previewData.addressesCount}</p>
                <p className="text-xs text-muted-foreground">Addresses</p>
              </Card>
            </div>
          ) : null}
        </div>

        {/* Combined totals */}
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">After Merge</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Combined Total Spent</p>
              <p className="text-lg font-bold text-emerald-600">
                {formatCurrency((primaryCustomer.total_spent || 0) + (secondaryCustomer.total_spent || 0))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Combined Loyalty Points</p>
              <p className="text-lg font-bold text-purple-600">
                {((primaryCustomer.loyalty_points || 0) + (secondaryCustomer.loyalty_points || 0)).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">This action cannot be undone</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              The secondary customer record ({secondaryCustomer.first_name} {secondaryCustomer.last_name}) will be permanently deleted.
              All their history will be transferred to the primary customer.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Merge Customers
            </DialogTitle>
            <DialogDescription>
              {step === 'select'
                ? 'Select two customer records to merge. The primary record will be kept.'
                : 'Review the merge preview. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {step === 'select' ? (
              <div className="space-y-6 py-4">
                {/* Customer selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderCustomerCard(
                    primaryCustomer,
                    'primary',
                    () => setSelectingFor('primary'),
                    primaryCustomer ? () => setPrimaryCustomer(null) : undefined
                  )}

                  <div className="hidden md:flex items-center justify-center">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <ArrowRight className="h-6 w-6" />
                      <span className="text-xs mt-1">Merge into</span>
                    </div>
                  </div>

                  {renderCustomerCard(
                    secondaryCustomer,
                    'secondary',
                    () => setSelectingFor('secondary'),
                    secondaryCustomer ? () => setSecondaryCustomer(null) : undefined
                  )}
                </div>

                {/* Search dialog */}
                {selectingFor && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        Search for {selectingFor === 'primary' ? 'Primary' : 'Secondary'} Customer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, email, or phone..."
                          aria-label="Search customers"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                          autoFocus
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setSearchQuery('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {searchLoading && (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-16" />
                          ))}
                        </div>
                      )}

                      {searchResults && searchResults.length > 0 && (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {searchResults.map((customer) => (
                            <button
                              key={customer.id}
                              className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between group"
                              onClick={() => handleSelectCustomer(customer)}
                              disabled={
                                customer.id === primaryCustomer?.id ||
                                customer.id === secondaryCustomer?.id
                              }
                            >
                              <div>
                                <p className="font-medium">
                                  {customer.first_name} {customer.last_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {customer.email || formatPhoneNumber(customer.phone, { fallback: '' }) || 'No contact info'}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      )}

                      {searchQuery && !searchLoading && searchResults?.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No customers found matching &quot;{searchQuery}&quot;
                        </p>
                      )}

                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectingFor(null);
                          setSearchQuery('');
                        }}
                      >
                        Cancel
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="py-4">
                {renderPreviewStep()}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            {step === 'select' ? (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('preview')}
                  disabled={!canProceedToPreview}
                >
                  Preview Merge
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep('select')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={mergeMutation.isPending}
                >
                  {mergeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    'Confirm Merge'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently merge {secondaryCustomer?.first_name} {secondaryCustomer?.last_name} into {primaryCustomer?.first_name} {primaryCustomer?.last_name}.
              The secondary customer record will be deleted and this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mergeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                'Yes, merge customers'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
