import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { sanitizeSearchInput } from '@/lib/sanitizeSearch';
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Plus,
  Truck,
  ClipboardList,
  AlertTriangle,
  MapPin,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { useLocationOptions } from '@/hooks/useLocations';

// --- Interfaces ---

interface ReceiptLocation {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

interface ReceivingRecord {
  id: string;
  tenant_id: string;
  shipment_number: string;
  vendor: string;
  received_date: string;
  expected_items: number | null;
  notes: string | null;
  status: string;
  qc_status: string | null;
  qc_notes: string | null;
  damaged_items: number | null;
  missing_items: number | null;
  location_id: string | null;
  location: ReceiptLocation | null;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'received' | 'qc_passed' | 'qc_failed';

// --- Zod Schemas ---

const createReceiptSchema = z.object({
  shipment_number: z
    .string()
    .min(1, 'Shipment number is required')
    .max(100, 'Shipment number too long'),
  vendor: z
    .string()
    .min(1, 'Vendor name is required')
    .max(200, 'Vendor name too long'),
  received_date: z.string().min(1, 'Received date is required'),
  expected_items: z.string().max(10).optional().default(''),
  notes: z.string().max(2000, 'Notes too long').optional().default(''),
  location_id: z.string().optional().default(''),
});

type CreateReceiptFormData = z.infer<typeof createReceiptSchema>;

const qcSchema = z.object({
  qc_status: z.enum(['passed', 'failed']),
  qc_notes: z.string().max(2000, 'QC notes too long').optional().default(''),
  damaged_items: z.coerce.number().int().min(0).default(0),
  missing_items: z.coerce.number().int().min(0).default(0),
});

type QCFormData = z.infer<typeof qcSchema>;

// --- Skeleton ---

function ReceivingPageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`stat-skel-${i}`}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <Skeleton className="h-10 flex-1 w-full" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={`filter-skel-${i}`} className="h-9 w-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Rows */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`row-skel-${i}`} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Component ---

export default function ReceivingPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { options: locationOptions, isLoading: locationsLoading, isError: locationsError } = useLocationOptions();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceivingRecord | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  // Create receipt form
  const createForm = useForm<CreateReceiptFormData>({
    resolver: zodResolver(createReceiptSchema),
    defaultValues: {
      shipment_number: '',
      vendor: '',
      received_date: new Date().toISOString().split('T')[0],
      expected_items: '',
      notes: '',
      location_id: '',
    },
  });

  // QC form
  const qcForm = useForm<QCFormData>({
    resolver: zodResolver(qcSchema),
    defaultValues: {
      qc_status: 'passed',
      qc_notes: '',
      damaged_items: 0,
      missing_items: 0,
    },
  });

  // Fetch receiving records with location data
  const { data: receipts, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.receiving.list(tenantId, `${filter}-${locationFilter}`),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        let query = supabase
          .from('receiving_records')
          .select(`
            *,
            location:locations(id, name, city, state)
          `)
          .eq('tenant_id', tenantId)
          .order('received_date', { ascending: false });

        if (filter !== 'all') {
          query = query.eq('status', filter);
        }

        if (locationFilter !== 'all') {
          query = query.eq('location_id', locationFilter);
        }

        const { data, error } = await query;

        // Gracefully handle missing table
        if (error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        if (error) throw error;
        setTableMissing(false);
        return (data ?? []) as ReceivingRecord[];
      } catch (error: unknown) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        if ('code' in errorObj && (errorObj as { code: string }).code === '42P01') {
          setTableMissing(true);
          return [];
        }
        throw errorObj;
      }
    },
    enabled: !!tenantId,
    retry: 2,
    staleTime: 60_000,
  });

  // Create receiving record
  const createReceipt = useMutation({
    mutationFn: async (receipt: CreateReceiptFormData) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      const { error } = await supabase
        .from('receiving_records')
        .insert([{
          shipment_number: receipt.shipment_number,
          vendor: receipt.vendor,
          received_date: receipt.received_date,
          notes: receipt.notes || null,
          tenant_id: tenantId,
          status: 'pending',
          expected_items: parseInt(receipt.expected_items ?? '') || 0,
          location_id: receipt.location_id || null,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Receiving record created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.receiving.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
      setReceiveDialogOpen(false);
      createForm.reset();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create receiving record', { error });
      toast.error('Failed to create receiving record', { description: humanizeError(error) });
    },
  });

  // Update receiving status
  const updateReceiptStatus = useMutation({
    mutationFn: async ({ id, status, qcData }: { id: string; status: string; qcData?: QCFormData }) => {
      if (!tenantId) throw new Error('Tenant context required');

      const updates: Record<string, unknown> = { status };
      if (qcData) {
        updates.qc_status = qcData.qc_status;
        updates.qc_notes = qcData.qc_notes;
        updates.damaged_items = qcData.damaged_items;
        updates.missing_items = qcData.missing_items;
      }

      const { error } = await supabase
        .from('receiving_records')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Receiving record updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.receiving.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      setQcDialogOpen(false);
      setSelectedReceipt(null);
      qcForm.reset();
    },
    onError: (error: unknown) => {
      logger.error('Failed to update receiving record', { error });
      toast.error('Failed to update receiving record', { description: humanizeError(error) });
    },
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactNode> = {
      pending: <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>,
      received: <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Truck className="h-3 w-3 mr-1" />Received</Badge>,
      qc_passed: <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />QC Passed</Badge>,
      qc_failed: <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />QC Failed</Badge>,
    };
    return badges[status] ?? <Badge variant="outline">{status}</Badge>;
  };

  const sanitizedSearch = sanitizeSearchInput(searchQuery);
  const filteredReceipts = receipts?.filter((receipt) =>
    receipt.shipment_number?.toLowerCase().includes(sanitizedSearch.toLowerCase()) ||
    receipt.vendor?.toLowerCase().includes(sanitizedSearch.toLowerCase())
  );

  // Calculate stats
  const totalReceipts = receipts?.length ?? 0;
  const pendingReceipts = receipts?.filter((r) => r.status === 'pending').length ?? 0;
  const qcPassedReceipts = receipts?.filter((r) => r.status === 'qc_passed').length ?? 0;
  const receivedReceipts = receipts?.filter((r) => r.status === 'received').length ?? 0;

  const onCreateSubmit = (data: CreateReceiptFormData) => {
    createReceipt.mutate(data);
  };

  const onQcSubmit = (data: QCFormData) => {
    if (selectedReceipt) {
      updateReceiptStatus.mutate({
        id: selectedReceipt.id,
        status: data.qc_status === 'passed' ? 'qc_passed' : 'qc_failed',
        qcData: data,
      });
    }
  };

  if (isLoading && !receipts) {
    return <ReceivingPageSkeleton />;
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Receiving & Packaging</h1>
          <p className="text-muted-foreground text-sm">
            Manage incoming shipments and quality control
            {isFetching && !isLoading && (
              <span className="ml-2 text-xs text-muted-foreground animate-pulse">Refreshing...</span>
            )}
          </p>
        </div>
        <Button onClick={() => setReceiveDialogOpen(true)} aria-label="Create new receipt">
          <Plus className="h-4 w-4 mr-2" />
          New Receipt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalReceipts}</div>
            <p className="text-xs text-muted-foreground">Total Receipts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{pendingReceipts}</div>
            <p className="text-xs text-muted-foreground">Pending Receipt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{qcPassedReceipts}</div>
            <p className="text-xs text-muted-foreground">QC Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{receivedReceipts}</div>
            <p className="text-xs text-muted-foreground">Received Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search shipments by number or vendor"
                placeholder="Search shipments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                maxLength={200}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Location filter */}
              <Select value={locationFilter} onValueChange={setLocationFilter} disabled={locationsLoading}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by location">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={locationsLoading ? 'Loading...' : 'All Locations'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationsError ? (
                    <div className="px-2 py-1.5 text-sm text-destructive">Failed to load locations</div>
                  ) : locationOptions.length === 0 && !locationsLoading ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No locations found</div>
                  ) : (
                    locationOptions.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {/* Status filters */}
              {(['all', 'pending', 'received', 'qc_passed'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(status)}
                  aria-label={`Filter by ${status === 'all' ? 'all statuses' : status.replace('_', ' ')}`}
                  aria-pressed={filter === status}
                >
                  {status === 'all' ? 'All' : status === 'qc_passed' ? 'QC Passed' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipts List */}
      {tableMissing ? (
        <Card>
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feature Not Available</h3>
            <p className="text-muted-foreground mb-4">
              The receiving_records table has not been created yet. This feature requires additional database setup.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact support to enable this feature or run the database migration to create the required tables.
            </p>
          </CardContent>
        </Card>
      ) : filteredReceipts?.length === 0 ? (
        <EnhancedEmptyState
          icon={Package}
          title={searchQuery || filter !== 'all' ? 'No matching receipts' : 'No receipts yet'}
          description={
            searchQuery || filter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first receiving record to start tracking shipments'
          }
          primaryAction={
            searchQuery || filter !== 'all'
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setFilter('all');
                    setLocationFilter('all');
                  },
                }
              : {
                  label: 'Create First Receipt',
                  onClick: () => setReceiveDialogOpen(true),
                  icon: Plus,
                }
          }
          compact
          designSystem="tenant-admin"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredReceipts?.map((receipt) => (
                <div key={receipt.id} className="p-4 hover:bg-accent transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Truck className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">Shipment #{receipt.shipment_number}</p>
                          <p className="text-sm text-muted-foreground truncate">{receipt.vendor}</p>
                        </div>
                        {getStatusBadge(receipt.status)}
                        {receipt.location && (
                          <Badge variant="outline">
                            <MapPin className="h-3 w-3 mr-1" />
                            {receipt.location.name}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Received Date</p>
                          <p className="font-medium">
                            {format(new Date(receipt.received_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expected Items</p>
                          <p className="font-medium">{receipt.expected_items || 'N/A'}</p>
                        </div>
                        {receipt.location && (
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium">
                              {receipt.location.city && receipt.location.state
                                ? `${receipt.location.city}, ${receipt.location.state}`
                                : receipt.location.name}
                            </p>
                          </div>
                        )}
                        {receipt.qc_status && (
                          <>
                            <div>
                              <p className="text-muted-foreground">Damaged Items</p>
                              <p className="font-medium text-red-500">{receipt.damaged_items ?? 0}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Missing Items</p>
                              <p className="font-medium text-orange-500">{receipt.missing_items ?? 0}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {receipt.notes && (
                        <p className="text-sm text-muted-foreground">{receipt.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {receipt.status === 'received' && (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`QC check for shipment ${receipt.shipment_number}`}
                          onClick={() => {
                            setSelectedReceipt(receipt);
                            qcForm.reset({
                              qc_status: 'passed',
                              qc_notes: '',
                              damaged_items: 0,
                              missing_items: 0,
                            });
                            setQcDialogOpen(true);
                          }}
                        >
                          <ClipboardList className="h-4 w-4 mr-2" />
                          QC Check
                        </Button>
                      )}
                      {receipt.status === 'pending' && (
                        <Button
                          variant="default"
                          size="sm"
                          aria-label={`Mark shipment ${receipt.shipment_number} as received`}
                          onClick={() => {
                            updateReceiptStatus.mutate({
                              id: receipt.id,
                              status: 'received',
                            });
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Received
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Receipt Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={(open) => {
        setReceiveDialogOpen(open);
        if (!open) createForm.reset();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Receiving Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="shipment-number">Shipment Number *</Label>
              <Input
                id="shipment-number"
                placeholder="SHIP-2024-001"
                maxLength={100}
                {...createForm.register('shipment_number')}
              />
              {createForm.formState.errors.shipment_number && (
                <p className="text-sm text-destructive mt-1">{createForm.formState.errors.shipment_number.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="vendor">Vendor *</Label>
              <Input
                id="vendor"
                placeholder="Vendor Name"
                maxLength={200}
                {...createForm.register('vendor')}
              />
              {createForm.formState.errors.vendor && (
                <p className="text-sm text-destructive mt-1">{createForm.formState.errors.vendor.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="location">Receiving Location</Label>
              <Select
                value={createForm.watch('location_id')}
                onValueChange={(value) => createForm.setValue('location_id', value)}
                disabled={locationsLoading}
              >
                <SelectTrigger aria-label="Select receiving location">
                  <SelectValue placeholder={locationsLoading ? 'Loading locations...' : 'Select a location (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  {locationsError ? (
                    <div className="px-2 py-1.5 text-sm text-destructive">Failed to load locations</div>
                  ) : locationOptions.length === 0 && !locationsLoading ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No locations available</div>
                  ) : (
                    locationOptions.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{loc.label}</span>
                          {loc.description && (
                            <span className="text-muted-foreground text-xs">
                              ({loc.description})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select which location will receive this shipment for inventory tracking
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="received-date">Received Date *</Label>
                <Input
                  id="received-date"
                  type="date"
                  {...createForm.register('received_date')}
                />
                {createForm.formState.errors.received_date && (
                  <p className="text-sm text-destructive mt-1">{createForm.formState.errors.received_date.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="expected-items">Expected Items</Label>
                <Input
                  id="expected-items"
                  type="number"
                  placeholder="10"
                  maxLength={10}
                  {...createForm.register('expected_items')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                maxLength={2000}
                {...createForm.register('notes')}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {(createForm.watch('notes') ?? '').length}/2000
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReceiveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createReceipt.isPending}
              >
                {createReceipt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {createReceipt.isPending ? 'Creating...' : 'Create Receipt'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QC Check Dialog */}
      <Dialog open={qcDialogOpen} onOpenChange={(open) => {
        setQcDialogOpen(open);
        if (!open) {
          setSelectedReceipt(null);
          qcForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quality Control Check</DialogTitle>
          </DialogHeader>
          <form onSubmit={qcForm.handleSubmit(onQcSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="qc-status">QC Status *</Label>
              <Select
                value={qcForm.watch('qc_status')}
                onValueChange={(value) => qcForm.setValue('qc_status', value as 'passed' | 'failed')}
              >
                <SelectTrigger aria-label="Select QC status">
                  <SelectValue placeholder="Select QC status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="damaged-items">Damaged Items</Label>
                <Input
                  id="damaged-items"
                  type="number"
                  min={0}
                  {...qcForm.register('damaged_items', { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="missing-items">Missing Items</Label>
                <Input
                  id="missing-items"
                  type="number"
                  min={0}
                  {...qcForm.register('missing_items', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="qc-notes">QC Notes</Label>
              <Textarea
                id="qc-notes"
                placeholder="Quality control notes..."
                maxLength={2000}
                {...qcForm.register('qc_notes')}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {(qcForm.watch('qc_notes') ?? '').length}/2000
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQcDialogOpen(false);
                  setSelectedReceipt(null);
                  qcForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateReceiptStatus.isPending}
              >
                {updateReceiptStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Complete QC
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
