import { useState } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
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
  Loader2
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

export default function ReceivingPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { options: locationOptions, isLoading: locationsLoading, isError: locationsError } = useLocationOptions();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'received' | 'qc_passed' | 'qc_failed'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Record<string, unknown> | null>(null);
  const [newReceipt, setNewReceipt] = useState({
    shipment_number: '',
    vendor: '',
    received_date: new Date().toISOString().split('T')[0],
    expected_items: '',
    notes: '',
    location_id: ''
  });
  const [qcData, setQcData] = useState({
    qc_status: 'passed',
    qc_notes: '',
    damaged_items: 0,
    missing_items: 0
  });

  const [tableMissing, setTableMissing] = useState(false);

  // Fetch receiving records with location data
  const { data: receipts, isLoading } = useQuery({
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
        return data ?? [];
      } catch (error: unknown) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        // Check for PostgreSQL table missing error (42P01)
        if ('code' in errorObj && errorObj.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        throw errorObj;
      }
    },
    enabled: !!tenantId,
  });

  // Create receiving record
  const createReceipt = useMutation({
    mutationFn: async (receipt: typeof newReceipt) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      const { error } = await supabase
        .from('receiving_records')
        .insert([{
          shipment_number: receipt.shipment_number,
          vendor: receipt.vendor,
          received_date: receipt.received_date,
          notes: receipt.notes,
          tenant_id: tenantId,
          status: 'pending',
          expected_items: parseInt(receipt.expected_items) || 0,
          location_id: receipt.location_id || null
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Receiving record created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.receiving.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
      setReceiveDialogOpen(false);
      setNewReceipt({
        shipment_number: '',
        vendor: '',
        received_date: new Date().toISOString().split('T')[0],
        expected_items: '',
        notes: '',
        location_id: ''
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to create receiving record', { error });
      toast.error('Failed to create receiving record', { description: humanizeError(error) });
    }
  });

  // Update receiving status
  const updateReceiptStatus = useMutation({
    mutationFn: async ({ id, status, qcData }: { id: string; status: string; qcData?: { qc_status: string; qc_notes: string; damaged_items: number; missing_items: number } }) => {
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
    },
    onError: (error: unknown) => {
      logger.error('Failed to update receiving record', { error });
      toast.error('Failed to update receiving record', { description: humanizeError(error) });
    }
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>,
      received: <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Truck className="h-3 w-3 mr-1" />Received</Badge>,
      qc_passed: <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />QC Passed</Badge>,
      qc_failed: <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />QC Failed</Badge>
    };
    return badges[status as keyof typeof badges] || <Badge variant="outline">{status}</Badge>;
  };

  const filteredReceipts = receipts?.filter(receipt =>
    receipt.shipment_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    receipt.vendor?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalReceipts = receipts?.length ?? 0;
  const pendingReceipts = receipts?.filter(r => r.status === 'pending').length ?? 0;
  const qcPassedReceipts = receipts?.filter(r => r.status === 'qc_passed').length ?? 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Receiving & Packaging</h1>
          <p className="text-muted-foreground">
            Manage incoming shipments and quality control
          </p>
        </div>
        <Button onClick={() => setReceiveDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Receipt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold">
              {receipts?.filter(r => r.status === 'received').length ?? 0}
            </div>
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
                aria-label="Search shipments"
                placeholder="Search shipments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Location filter */}
              <Select value={locationFilter} onValueChange={setLocationFilter} disabled={locationsLoading}>
                <SelectTrigger className="w-[180px]">
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
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={filter === 'received' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('received')}
              >
                Received
              </Button>
              <Button
                variant={filter === 'qc_passed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('qc_passed')}
              >
                QC Passed
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipts List */}
      {isLoading ? (
        <EnhancedLoadingState variant="table" count={5} message="Loading receipts..." />
      ) : tableMissing ? (
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
        <Card>
          <CardContent className="py-6 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No receipts found</p>
            <Button className="mt-4" onClick={() => setReceiveDialogOpen(true)}>
              Create Your First Receipt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredReceipts?.map((receipt) => (
                <div key={receipt.id} className="p-4 hover:bg-accent transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">Shipment #{receipt.shipment_number}</p>
                          <p className="text-sm text-muted-foreground">{receipt.vendor}</p>
                        </div>
                        {getStatusBadge(receipt.status)}
                        {receipt.location && (
                          <Badge variant="outline" className="ml-2">
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

                    <div className="flex items-center gap-2 ml-4">
                      {receipt.status === 'received' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReceipt(receipt);
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
                          onClick={() => {
                            updateReceiptStatus.mutate({
                              id: receipt.id,
                              status: 'received'
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
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Receiving Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shipment-number">Shipment Number *</Label>
              <Input
                id="shipment-number"
                placeholder="SHIP-2024-001"
                value={newReceipt.shipment_number}
                onChange={(e) => setNewReceipt({ ...newReceipt, shipment_number: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="vendor">Vendor *</Label>
              <Input
                id="vendor"
                placeholder="Vendor Name"
                value={newReceipt.vendor}
                onChange={(e) => setNewReceipt({ ...newReceipt, vendor: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="location">Receiving Location</Label>
              <Select
                value={newReceipt.location_id}
                onValueChange={(value) => setNewReceipt({ ...newReceipt, location_id: value })}
                disabled={locationsLoading}
              >
                <SelectTrigger>
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
                  value={newReceipt.received_date}
                  onChange={(e) => setNewReceipt({ ...newReceipt, received_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="expected-items">Expected Items</Label>
                <Input
                  id="expected-items"
                  type="number"
                  placeholder="10"
                  value={newReceipt.expected_items}
                  onChange={(e) => setNewReceipt({ ...newReceipt, expected_items: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={newReceipt.notes}
                onChange={(e) => setNewReceipt({ ...newReceipt, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createReceipt.mutate(newReceipt)}
              disabled={!newReceipt.shipment_number || !newReceipt.vendor || createReceipt.isPending}
            >
              {createReceipt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {createReceipt.isPending ? 'Creating...' : 'Create Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Check Dialog */}
      <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quality Control Check</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="qc-status">QC Status *</Label>
              <Select
                value={qcData.qc_status}
                onValueChange={(value) => setQcData({ ...qcData, qc_status: value })}
              >
                <SelectTrigger>
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
                  value={qcData.damaged_items || ''}
                  onChange={(e) => setQcData({ ...qcData, damaged_items: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="missing-items">Missing Items</Label>
                <Input
                  id="missing-items"
                  type="number"
                  value={qcData.missing_items || ''}
                  onChange={(e) => setQcData({ ...qcData, missing_items: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="qc-notes">QC Notes</Label>
              <Textarea
                id="qc-notes"
                placeholder="Quality control notes..."
                value={qcData.qc_notes}
                onChange={(e) => setQcData({ ...qcData, qc_notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setQcDialogOpen(false);
                setSelectedReceipt(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedReceipt) {
                  updateReceiptStatus.mutate({
                    id: selectedReceipt.id as string,
                    status: qcData.qc_status === 'passed' ? 'qc_passed' : 'qc_failed',
                    qcData
                  });
                }
              }}
              disabled={updateReceiptStatus.isPending}
            >
              {updateReceiptStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete QC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

