import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Package, Plus, Edit, Trash2, Mail, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';

interface VendorFormData {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  license_number: string;
  notes: string;
}

interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  website: string | null;
  license_number: string | null;
  notes: string | null;
  status: string | null;
  account_id: string;
  created_at: string | null;
  updated_at: string | null;
}

const initialFormData: VendorFormData = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  license_number: '',
  notes: ''
};

export function VendorManagement() {
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);

  const { data: vendors = [], isLoading: loading, isError: loadError, refetch: loadVendors } = useQuery({
    queryKey: queryKeys.vendors.byTenant(tenantId ?? ''),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, contact_name, contact_email, contact_phone, address, website, license_number, notes, status, account_id, created_at, updated_at')
        .eq('account_id', tenantId)
        .order('name');
      if (error) {
        logger.error('Failed to load vendors', { error });
        throw error;
      }
      return (data ?? []) as unknown as Vendor[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ vendor, isEdit }: { vendor: VendorFormData; isEdit: boolean }) => {
      if (!tenantId) throw new Error('Tenant context required');
      const vendorData = {
        name: vendor.name,
        contact_name: vendor.contact_name || null,
        contact_email: vendor.email || null,
        contact_phone: vendor.phone || null,
        address: vendor.address || null,
        website: vendor.website || null,
        license_number: vendor.license_number || null,
        notes: vendor.notes || null,
      };
      if (isEdit && editingVendor) {
        const { error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', editingVendor.id)
          .eq('account_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert({ ...vendorData, account_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.byTenant(tenantId ?? '') });
      toast.success(variables.isEdit ? 'Vendor updated successfully' : 'Vendor added successfully');
      setIsDialogOpen(false);
      setEditingVendor(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      logger.error('Failed to save vendor', { error });
      toast.error('Failed to save vendor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!tenantId) throw new Error('Tenant context required');
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId)
        .eq('account_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.byTenant(tenantId ?? '') });
      toast.success('Vendor deleted successfully');
      setDeleteDialogOpen(false);
      setVendorToDelete(null);
    },
    onError: (error: Error) => {
      logger.error('Failed to delete vendor', { error });
      toast.error('Failed to delete vendor');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ vendor: formData, isEdit: !!editingVendor });
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contact_name: vendor.contact_name ?? '',
      email: vendor.contact_email ?? '',
      phone: vendor.contact_phone ?? '',
      address: vendor.address ?? '',
      website: vendor.website ?? '',
      license_number: vendor.license_number ?? '',
      notes: vendor.notes ?? ''
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setVendorToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!vendorToDelete) return;
    deleteMutation.mutate(vendorToDelete.id);
  };

  if (accountLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading vendors...">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return <PageErrorState onRetry={loadVendors} message="Failed to load vendors. Please try again." />;
  }

  return (
    <div className="space-y-4">
      <SEOHead
        title="Vendor Management"
        description="Manage your suppliers and vendors"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Vendors</h1>
          <p className="text-muted-foreground">Manage your suppliers</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingVendor(null);
              setFormData(initialFormData);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ABC Supply Co."
                  required
                />
              </div>

              <div>
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@vendor.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Vendor St, City, State"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://vendor.com"
                  />
                </div>

                <div>
                  <Label htmlFor="license_number">License Number</Label>
                  <Input
                    id="license_number"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder="LIC-12345"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>{editingVendor ? 'Update' : 'Create'} Vendor</>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {vendors.length === 0 ? (
        <EnhancedEmptyState
          icon={Package}
          title="No vendors yet"
          description="Add your first vendor to start managing your suppliers"
          primaryAction={{
            label: 'Add Vendor',
            onClick: () => setIsDialogOpen(true),
            icon: Plus,
          }}
          compact
          designSystem="tenant-admin"
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {vendors.map((vendor) => (
            <Card key={vendor.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{vendor.name}</CardTitle>
                    <Badge className="mt-2" variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                      {vendor.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(vendor)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(vendor.id, vendor.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {vendor.contact_name && (
                    <div>
                      <span className="text-muted-foreground">Contact:</span>
                      <span className="ml-2 font-medium">{vendor.contact_name}</span>
                    </div>
                  )}
                  {vendor.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.contact_email}</span>
                    </div>
                  )}
                  {vendor.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.contact_phone}</span>
                    </div>
                  )}
                  {vendor.website && (
                    <div className="text-sm">
                      <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        itemName={vendorToDelete?.name}
        itemType="vendor"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
