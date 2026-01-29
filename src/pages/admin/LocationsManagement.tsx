import { useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
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
import { MapPin, Plus, Edit, Trash2, Building, Package, Truck, Users, AlertTriangle } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { useLocations, type CreateLocationInput } from '@/hooks/useLocations';
import { Skeleton } from '@/components/ui/skeleton';

export default function LocationsManagement() {
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const {
    locations,
    isLoading,
    isSummaryLoading,
    createLocation,
    updateLocation,
    deleteLocation,
    isUpdating,
    isDeleting,
    getLocationSummary
  } = useLocations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<{ id: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState<CreateLocationInput>({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    license_number: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    if (editingLocation) {
      updateLocation({ id: editingLocation.id, ...formData });
    } else {
      createLocation(formData);
    }

    setIsDialogOpen(false);
    setEditingLocation(null);
    setFormData({ name: '', address: '', city: '', state: '', zip_code: '', phone: '', email: '', license_number: '' });
  };

  const handleEdit = (location: { id: string; name: string; address: string; city?: string | null; state?: string | null; zip_code?: string | null; phone?: string | null; email?: string | null; license_number?: string | null }) => {
    setEditingLocation({ id: location.id });
    setFormData({
      name: location.name,
      address: location.address,
      city: location.city || '',
      state: location.state || '',
      zip_code: location.zip_code || '',
      phone: location.phone || '',
      email: location.email || '',
      license_number: location.license_number || ''
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setLocationToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!locationToDelete) return;
    deleteLocation(locationToDelete.id);
    setDeleteDialogOpen(false);
    setLocationToDelete(null);
  };

  if (accountLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEOHead
        title="Locations Management"
        description="Manage your business locations"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Locations</h1>
          <p className="text-muted-foreground">Manage your business locations</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingLocation(null);
              setFormData({ name: '', address: '', city: '', state: '', zip_code: '', phone: '', email: '', license_number: '' });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Location Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Downtown Store"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Street Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St"
                  required
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="New York"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="NY"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="zip">ZIP Code *</Label>
                  <Input
                    id="zip"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    placeholder="10001"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="location@company.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="license">Business License Number</Label>
                <Input
                  id="license"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="LIC-12345"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingLocation ? 'Update' : 'Create'} Location
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {locations.length === 0 ? (
        <EnhancedEmptyState
          icon={Building}
          title="No Locations Yet"
          description="Add your first location to get started."
          primaryAction={{
            label: "Add Location",
            onClick: () => setIsDialogOpen(true),
            icon: Plus
          }}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {locations.map((location) => {
            const summary = getLocationSummary(location.id);
            return (
              <Card key={location.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {location.name}
                      </CardTitle>
                      <Badge className="mt-2" variant={location.status === 'active' ? 'default' : 'secondary'}>
                        {location.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(location)}
                        disabled={isUpdating}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(location.id, location.name)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Address Info */}
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Address:</span>
                        <p className="font-medium">{location.address}, {location.city}, {location.state} {location.zip_code}</p>
                      </div>
                      {location.phone && (
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <p className="font-medium">{location.phone}</p>
                        </div>
                      )}
                      {location.license_number && (
                        <div>
                          <span className="text-muted-foreground">License:</span>
                          <p className="font-medium">{location.license_number}</p>
                        </div>
                      )}
                    </div>

                    {/* Operations Summary */}
                    {isSummaryLoading ? (
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : summary ? (
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <Truck className="h-3 w-3" />
                            <span className="text-xs">Receiving</span>
                          </div>
                          <p className="text-lg font-bold">{summary.total_receiving_records}</p>
                          {summary.pending_receiving > 0 && (
                            <p className="text-xs text-yellow-600">{summary.pending_receiving} pending</p>
                          )}
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <Package className="h-3 w-3" />
                            <span className="text-xs">Inventory</span>
                          </div>
                          <p className="text-lg font-bold">{summary.total_products}</p>
                          <p className="text-xs text-muted-foreground">{summary.total_inventory_quantity} units</p>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            <span className="text-xs">Runners</span>
                          </div>
                          <p className="text-lg font-bold">{summary.total_runners}</p>
                          <p className="text-xs text-green-600">{summary.active_runners} active</p>
                        </div>
                      </div>
                    ) : null}

                    {/* Low Stock Alert */}
                    {summary && summary.low_stock_products > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-700 dark:text-yellow-500 text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{summary.low_stock_products} product{summary.low_stock_products > 1 ? 's' : ''} low on stock</span>
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
        itemName={locationToDelete?.name}
        itemType="location"
        isLoading={isDeleting}
      />
    </div>
  );
}
