import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';

type BatchRow = Database['public']['Tables']['inventory_batches']['Row'];

interface BatchWithProduct extends BatchRow {
  tenant_id?: string | null;
  product: { name: string; image_url: string | null } | null;
}

interface NewBatchFormData {
  batch_number: string;
  product_id: string;
  quantity_lbs: number;
  received_date: string;
  expiration_date: string;
  warehouse_location: string;
  notes: string;
}

const INITIAL_FORM_DATA: NewBatchFormData = {
  batch_number: '',
  product_id: '',
  quantity_lbs: 0,
  received_date: new Date().toISOString().split('T')[0],
  expiration_date: '',
  warehouse_location: '',
  notes: '',
};

function isExpiringSoon(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return new Date(expirationDate) <= thirtyDaysFromNow;
}

function isExpired(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

function getStatusBadge(batch: BatchWithProduct) {
  if (isExpired(batch.expiration_date)) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Expired
      </Badge>
    );
  }
  if (isExpiringSoon(batch.expiration_date)) {
    return (
      <Badge variant="outline" className="gap-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
        <AlertTriangle className="h-3 w-3" />
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
      <CheckCircle className="h-3 w-3" />
      Active
    </Badge>
  );
}

export default function BatchesPage() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { execute: executeCreditAction } = useCreditGatedAction();

  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBatch, setNewBatch] = useState<NewBatchFormData>(INITIAL_FORM_DATA);
  const [tableMissing, setTableMissing] = useState(false);

  const resetForm = () => {
    setNewBatch({ ...INITIAL_FORM_DATA, received_date: new Date().toISOString().split('T')[0] });
    setCreateDialogOpen(false);
  };

  // Fetch batches
  const { data: batches, isLoading } = useQuery({
    queryKey: queryKeys.batches.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('inventory_batches')
          .select(`
            *,
            product:products(name, image_url)
          `)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        if (error) throw error;
        setTableMissing(false);
        return (data ?? []) as BatchWithProduct[];
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === '42P01') {
          setTableMissing(true);
          return [];
        }
        throw err;
      }
    },
    enabled: !!tenantId,
    retry: 2,
  });

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: queryKeys.products.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .order('name');

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === '42P01') return [];
        throw err;
      }
    },
    enabled: !!tenantId,
    retry: 2,
  });

  // Create batch
  const createBatch = useMutation({
    mutationFn: async (batch: NewBatchFormData) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('inventory_batches')
        .insert([{
          batch_number: batch.batch_number,
          product_id: batch.product_id || null,
          quantity_lbs: batch.quantity_lbs,
          received_date: batch.received_date || null,
          expiration_date: batch.expiration_date || null,
          warehouse_location: batch.warehouse_location || null,
          notes: batch.notes || null,
          tenant_id: tenantId,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Batch created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      resetForm();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create batch', error, { component: 'BatchesPage', tenantId });
      toast.error('Failed to create batch', { description: humanizeError(error) });
    },
  });

  const filteredBatches = batches?.filter((batch) =>
    batch.batch_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalBatches = batches?.length ?? 0;
  const expiringBatches = batches?.filter((b) => isExpiringSoon(b.expiration_date) && !isExpired(b.expiration_date)).length ?? 0;
  const expiredBatches = batches?.filter((b) => isExpired(b.expiration_date)).length ?? 0;
  const totalQuantity = batches?.reduce((sum, b) => sum + (b.quantity_lbs ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToAdmin('inventory-hub')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Batches & Lots</h1>
          <p className="text-muted-foreground">
            Track inventory batches, expiration dates, and lot numbers
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Batch
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalBatches}</div>
            <p className="text-xs text-muted-foreground">Total Batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalQuantity} lbs</div>
            <p className="text-xs text-muted-foreground">Total Quantity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{expiringBatches}</div>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{expiredBatches}</div>
            <p className="text-xs text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search batches"
              placeholder="Search batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Batches List */}
      {isLoading ? (
        <EnhancedLoadingState variant="table" count={5} message="Loading batches..." />
      ) : tableMissing ? (
        <Card>
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feature Not Available</h3>
            <p className="text-muted-foreground mb-4">
              The inventory batches table has not been created yet. This feature requires additional database setup.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact support to enable this feature or run the database migration to create the required tables.
            </p>
          </CardContent>
        </Card>
      ) : filteredBatches?.length === 0 ? (
        <EnhancedEmptyState
          icon={Package}
          title="No Batches Found"
          description="Create your first batch to track lot numbers and expiration dates."
          primaryAction={{
            label: 'Create Your First Batch',
            onClick: () => setCreateDialogOpen(true),
            icon: Plus,
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredBatches?.map((batch) => (
                <div key={batch.id} className="p-4 hover:bg-accent transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-muted">
                      {batch.product?.image_url ? (
                        <img
                          src={batch.product.image_url}
                          alt={batch.product.name ?? 'Product'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Batch Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{batch.product?.name ?? 'Unknown Product'}</p>
                          <p className="text-sm text-muted-foreground">
                            Batch #{batch.batch_number}
                          </p>
                        </div>
                        {getStatusBadge(batch)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-medium">{batch.quantity_lbs ?? 0} lbs</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Received</p>
                            <p className="font-medium">
                              {batch.received_date
                                ? format(new Date(batch.received_date), 'MMM d, yyyy')
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Expires</p>
                            <p className="font-medium">
                              {batch.expiration_date
                                ? format(new Date(batch.expiration_date), 'MMM d, yyyy')
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium">{batch.warehouse_location ?? 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {batch.notes && (
                        <p className="text-sm text-muted-foreground">{batch.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batch-number">Batch Number *</Label>
              <Input
                id="batch-number"
                placeholder="BM-2024-001"
                value={newBatch.batch_number}
                onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="product">Product *</Label>
              <Select
                value={newBatch.product_id}
                onValueChange={(value) => setNewBatch({ ...newBatch, product_id: value })}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity (lbs) *</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                placeholder="10"
                value={newBatch.quantity_lbs || ''}
                onChange={(e) => setNewBatch({ ...newBatch, quantity_lbs: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="received-date">Received Date *</Label>
                <Input
                  id="received-date"
                  type="date"
                  value={newBatch.received_date}
                  onChange={(e) => setNewBatch({ ...newBatch, received_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="expiration-date">Expiration Date *</Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={newBatch.expiration_date}
                  onChange={(e) => setNewBatch({ ...newBatch, expiration_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Storage Location</Label>
              <Input
                id="location"
                placeholder="Warehouse A, Shelf 3"
                value={newBatch.warehouse_location}
                onChange={(e) => setNewBatch({ ...newBatch, warehouse_location: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information..."
                value={newBatch.notes}
                onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await executeCreditAction('receiving_log', async () => {
                  await createBatch.mutateAsync(newBatch);
                });
              }}
              disabled={!newBatch.batch_number || !newBatch.product_id || !newBatch.quantity_lbs || createBatch.isPending}
            >
              {createBatch.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Batch'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
