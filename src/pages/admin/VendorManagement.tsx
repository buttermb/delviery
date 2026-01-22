import { useState, useEffect, useCallback } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Package, Plus, Edit, Trash2, Mail, Phone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { handleError } from "@/utils/errorHandling/handlers";

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
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);

  const loadVendors = useCallback(async () => {
    if (!tenant) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('account_id', tenant.id)
        .order('name');

      if (error) throw error;
      setVendors((data || []) as Vendor[]);
    } catch (error) {
      handleError(error, {
        component: 'VendorManagement.loadVendors',
        toastTitle: 'Error',
        showToast: true
      });
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant) {
      loadVendors();
    }
  }, [tenant, loadVendors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setIsSaving(true);
    try {
      const vendorData = {
        name: formData.name,
        contact_name: formData.contact_name || null,
        contact_email: formData.email || null,
        contact_phone: formData.phone || null,
        address: formData.address || null,
        website: formData.website || null,
        license_number: formData.license_number || null,
        notes: formData.notes || null,
      };

      if (editingVendor) {
        if (!tenant?.id) throw new Error('Tenant context required');

        const { error } = await supabase
          .from('vendors')
          .update(vendorData as Record<string, unknown>)
          .eq('id', editingVendor.id)
          .eq('account_id', tenant.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Vendor updated successfully'
        });
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert({
            ...vendorData,
            account_id: tenant.id
          } as Record<string, unknown>);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Vendor added successfully'
        });
      }

      setIsDialogOpen(false);
      setEditingVendor(null);
      setFormData(initialFormData);
      loadVendors();
    } catch (error) {
      handleError(error, {
        component: 'VendorManagement.handleSubmit',
        toastTitle: 'Error',
        showToast: true
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contact_name: vendor.contact_name || '',
      email: vendor.contact_email || '',
      phone: vendor.contact_phone || '',
      address: vendor.address || '',
      website: vendor.website || '',
      license_number: vendor.license_number || '',
      notes: vendor.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setVendorToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!vendorToDelete || !tenant) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorToDelete.id)
        .eq('account_id', tenant.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Vendor deleted successfully'
      });

      loadVendors();
      setDeleteDialogOpen(false);
      setVendorToDelete(null);
    } catch (error) {
      handleError(error, {
        component: 'VendorManagement.handleDelete',
        toastTitle: 'Error',
        showToast: true
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (accountLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEOHead
        title="Vendor Management"
        description="Manage your suppliers and vendors"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendors</h1>
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
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
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
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No vendors yet</h3>
            <p className="text-muted-foreground mb-4">Add your first vendor to get started</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </CardContent>
        </Card>
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
        isLoading={isDeleting}
      />
    </div>
  );
}
