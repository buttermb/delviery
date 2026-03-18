import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Package, Plus, Edit, Trash2, Mail, Phone, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';

type Vendor = Database['public']['Tables']['vendors']['Row'];

const vendorFormSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(200, 'Name must be under 200 characters'),
  contact_name: z.string().max(200).optional().or(z.literal('')),
  contact_email: z.union([
    z.string().email('Invalid email address'),
    z.literal(''),
  ]),
  contact_phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  zip_code: z.string().max(20).optional().or(z.literal('')),
  license_number: z.string().max(100).optional().or(z.literal('')),
  tax_id: z.string().max(50).optional().or(z.literal('')),
  payment_terms: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

const defaultFormValues: VendorFormValues = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  license_number: '',
  tax_id: '',
  payment_terms: '',
  notes: '',
};

export function VendorManagement() {
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (editingVendor) {
      form.reset({
        name: editingVendor.name,
        contact_name: editingVendor.contact_name ?? '',
        contact_email: editingVendor.contact_email ?? '',
        contact_phone: editingVendor.contact_phone ?? '',
        address: editingVendor.address ?? '',
        city: editingVendor.city ?? '',
        state: editingVendor.state ?? '',
        zip_code: editingVendor.zip_code ?? '',
        license_number: editingVendor.license_number ?? '',
        tax_id: editingVendor.tax_id ?? '',
        payment_terms: editingVendor.payment_terms ?? '',
        notes: editingVendor.notes ?? '',
      });
    } else if (isDialogOpen) {
      form.reset(defaultFormValues);
    }
  }, [editingVendor, isDialogOpen, form]);

  const { data: vendors = [], isLoading: loading, isError: loadError, refetch: loadVendors } = useQuery({
    queryKey: queryKeys.vendors.byTenant(tenantId ?? ''),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('account_id', tenantId)
        .order('name');
      if (error) {
        logger.error('Failed to load vendors', { error });
        throw error;
      }
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ values, isEdit }: { values: VendorFormValues; isEdit: boolean }) => {
      if (!tenantId) throw new Error('Tenant context required');
      const vendorData = {
        name: values.name,
        contact_name: values.contact_name || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        zip_code: values.zip_code || null,
        license_number: values.license_number || null,
        tax_id: values.tax_id || null,
        payment_terms: values.payment_terms || null,
        notes: values.notes || null,
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
      form.reset(defaultFormValues);
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

  const onSubmit = (values: VendorFormValues) => {
    saveMutation.mutate({ values, isEdit: !!editingVendor });
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
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

  const formatAddress = (vendor: Vendor): string | null => {
    const parts = [vendor.address, vendor.city, vendor.state, vendor.zip_code].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
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
            <div key={`skeleton-${i}`} className="rounded-lg border bg-card p-6 space-y-4">
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
              form.reset(defaultFormValues);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Supply Co." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@vendor.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Vendor St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="license_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Number</FormLabel>
                        <FormControl>
                          <Input placeholder="LIC-12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input placeholder="XX-XXXXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="Net 30" {...field} />
                      </FormControl>
                      <FormMessage />
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
                          placeholder="Additional notes about this vendor..."
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
                </DialogFooter>
              </form>
            </Form>
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
          {vendors.map((vendor) => {
            const fullAddress = formatAddress(vendor);
            return (
              <Card key={vendor.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{vendor.name}</CardTitle>
                      <Badge className="mt-2" variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                        {vendor.status ?? 'unknown'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(vendor)}
                        aria-label={`Edit ${vendor.name}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(vendor.id, vendor.name)}
                        aria-label={`Delete ${vendor.name}`}
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
                    {fullAddress && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{fullAddress}</span>
                      </div>
                    )}
                    {vendor.license_number && (
                      <div>
                        <span className="text-muted-foreground">License:</span>
                        <span className="ml-2">{vendor.license_number}</span>
                      </div>
                    )}
                    {vendor.payment_terms && (
                      <div>
                        <span className="text-muted-foreground">Terms:</span>
                        <span className="ml-2">{vendor.payment_terms}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
