import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Plus,
  Truck,
  ClipboardList,
  AlertTriangle
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

export default function ReceivingPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'received' | 'qc_passed' | 'qc_failed'>('all');
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [newReceipt, setNewReceipt] = useState({
    shipment_number: '',
    vendor: '',
    received_date: new Date().toISOString().split('T')[0],
    expected_items: '',
    notes: ''
  });
  const [qcData, setQcData] = useState({
    qc_status: 'passed',
    qc_notes: '',
    damaged_items: 0,
    missing_items: 0
  });

  const [tableMissing, setTableMissing] = useState(false);

  // Fetch receiving records
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['receiving', tenantId, filter],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        let query = supabase
          .from('receiving_records')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('received_date', { ascending: false });

        if (filter !== 'all') {
          query = query.eq('status', filter);
        }

        const { data, error } = await query;
        
        // Gracefully handle missing table
        if (error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        if (error) throw error;
        setTableMissing(false);
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        throw error;
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
          ...receipt,
          tenant_id: tenantId,
          status: 'pending',
          expected_items: parseInt(receipt.expected_items) || 0
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Receiving record created successfully!' });
      queryClient.invalidateQueries({ queryKey: ['receiving'] });
      setReceiveDialogOpen(false);
      setNewReceipt({
        shipment_number: '',
        vendor: '',
        received_date: new Date().toISOString().split('T')[0],
        expected_items: '',
        notes: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create receiving record',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Update receiving status
  const updateReceiptStatus = useMutation({
    mutationFn: async ({ id, status, qcData }: { id: string; status: string; qcData?: any }) => {
      const updates: any = { status };
      if (qcData) {
        updates.qc_status = qcData.qc_status;
        updates.qc_notes = qcData.qc_notes;
        updates.damaged_items = qcData.damaged_items;
        updates.missing_items = qcData.missing_items;
      }

      const { error } = await supabase
        .from('receiving_records')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Receiving record updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['receiving'] });
      setQcDialogOpen(false);
      setSelectedReceipt(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update receiving record',
        description: error.message,
        variant: 'destructive'
      });
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
  const totalReceipts = receipts?.length || 0;
  const pendingReceipts = receipts?.filter(r => r.status === 'pending').length || 0;
  const qcPassedReceipts = receipts?.filter(r => r.status === 'qc_passed').length || 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Receiving & Packaging</h1>
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
              {receipts?.filter(r => r.status === 'received').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Received Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shipments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
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
        <div className="text-center py-12">Loading receipts...</div>
      ) : tableMissing ? (
        <Card>
          <CardContent className="py-12 text-center">
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
          <CardContent className="py-12 text-center">
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
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                        {receipt.qc_status && (
                          <>
                            <div>
                              <p className="text-muted-foreground">Damaged Items</p>
                              <p className="font-medium text-red-500">{receipt.damaged_items || 0}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Missing Items</p>
                              <p className="font-medium text-orange-500">{receipt.missing_items || 0}</p>
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
              Create Receipt
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
                  <SelectValue />
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
                    id: selectedReceipt.id,
                    status: qcData.qc_status === 'passed' ? 'qc_passed' : 'qc_failed',
                    qcData
                  });
                }
              }}
              disabled={updateReceiptStatus.isPending}
            >
              Complete QC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

