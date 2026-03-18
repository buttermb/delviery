import { useState, useCallback } from 'react';
import { z } from 'zod';
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
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Plus, Edit, Trash2, Building, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';
import { formatPhoneNumber } from '@/lib/formatters';
import { useLocations, type CreateLocationInput, type Location } from '@/hooks/useLocations';

const locationFormSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(200, 'Name must be 200 characters or less'),
  address: z.string().min(1, 'Street address is required').max(500, 'Address must be 500 characters or less'),
  city: z.string().min(1, 'City is required').max(100, 'City must be 100 characters or less'),
  state: z.string().min(1, 'State is required').max(50, 'State must be 50 characters or less'),
  zip_code: z.string().min(1, 'ZIP code is required').max(20, 'ZIP code must be 20 characters or less'),
  phone: z.string().max(20, 'Phone must be 20 characters or less').optional().or(z.literal('')),
  email: z.string().email('Invalid email address').max(254, 'Email must be 254 characters or less').optional().or(z.literal('')),
  license_number: z.string().max(100, 'License number must be 100 characters or less').optional().or(z.literal('')),
});

type LocationFormData = z.infer<typeof locationFormSchema>;

const defaultFormData: LocationFormData = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  email: '',
  license_number: '',
};

export default function LocationsManagement() {
  const {
    locations,
    isLoading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
    isCreating,
    isUpdating,
    isDeleting,
    refetch,
  } = useLocations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState<LocationFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const isSaving = isCreating || isUpdating;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const result = locationFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0];
        if (field && !fieldErrors[field as string]) {
          fieldErrors[field as string] = err.message;
        }
      });
      setFormErrors(fieldErrors);
      toast.error('Please fix the validation errors');
      return;
    }

    setFormErrors({});
    const input: CreateLocationInput = {
      name: result.data.name,
      address: result.data.address,
      city: result.data.city,
      state: result.data.state,
      zip_code: result.data.zip_code,
      phone: result.data.phone || undefined,
      email: result.data.email || undefined,
      license_number: result.data.license_number || undefined,
    };

    if (editingLocation) {
      updateLocation(
        { id: editingLocation.id, ...input },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            setEditingLocation(null);
            setFormData(defaultFormData);
          },
        }
      );
    } else {
      createLocation(input, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingLocation(null);
          setFormData(defaultFormData);
        },
      });
    }
  }, [formData, editingLocation, createLocation, updateLocation]);

  const handleEdit = useCallback((location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address,
      city: location.city ?? '',
      state: location.state ?? '',
      zip_code: location.zip_code ?? '',
      phone: location.phone ?? '',
      email: location.email ?? '',
      license_number: location.license_number ?? '',
    });
    setFormErrors({});
    setIsDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setLocationToDelete({ id, name });
    setDeleteDialogOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!locationToDelete) return;

    deleteLocation(locationToDelete.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setLocationToDelete(null);
      },
    });
  }, [locationToDelete, deleteLocation]);

  const handleOpenNewDialog = useCallback(() => {
    setEditingLocation(null);
    setFormData(defaultFormData);
    setFormErrors({});
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading locations">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={`skeleton-${i}`} className="rounded-lg border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <PageErrorState onRetry={refetch} message="Failed to load locations. Please try again." />;
  }

  return (
    <div className="space-y-4">
      <SEOHead
        title="Locations Management"
        description="Manage your business locations"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Locations</h1>
          <p className="text-muted-foreground">Manage your business locations</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenNewDialog}>
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
                  maxLength={200}
                  required
                />
                {formErrors.name && <p className="text-sm text-destructive mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <Label htmlFor="address">Street Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St"
                  maxLength={500}
                  required
                />
                {formErrors.address && <p className="text-sm text-destructive mt-1">{formErrors.address}</p>}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="New York"
                    maxLength={100}
                    required
                  />
                  {formErrors.city && <p className="text-sm text-destructive mt-1">{formErrors.city}</p>}
                </div>

                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="NY"
                    maxLength={50}
                    required
                  />
                  {formErrors.state && <p className="text-sm text-destructive mt-1">{formErrors.state}</p>}
                </div>

                <div>
                  <Label htmlFor="zip">ZIP Code *</Label>
                  <Input
                    id="zip"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    placeholder="10001"
                    maxLength={20}
                    required
                  />
                  {formErrors.zip_code && <p className="text-sm text-destructive mt-1">{formErrors.zip_code}</p>}
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
                    maxLength={20}
                  />
                  {formErrors.phone && <p className="text-sm text-destructive mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="location@company.com"
                    maxLength={254}
                  />
                  {formErrors.email && <p className="text-sm text-destructive mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="license">Business License Number</Label>
                <Input
                  id="license"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="LIC-12345"
                  maxLength={100}
                />
                {formErrors.license_number && <p className="text-sm text-destructive mt-1">{formErrors.license_number}</p>}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
          {locations.map((location) => (
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
                      aria-label={`Edit ${location.name}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(location.id, location.name)}
                      aria-label={`Delete ${location.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium">
                      {location.address}
                      {location.city && `, ${location.city}`}
                      {location.state && `, ${location.state}`}
                      {location.zip_code && ` ${location.zip_code}`}
                    </p>
                  </div>
                  {location.phone && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium">{formatPhoneNumber(location.phone)}</p>
                    </div>
                  )}
                  {location.license_number && (
                    <div>
                      <span className="text-muted-foreground">License:</span>
                      <p className="font-medium">{location.license_number}</p>
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
        itemName={locationToDelete?.name}
        itemType="location"
        isLoading={isDeleting}
      />
    </div>
  );
}
