/**
 * CustomerDeliveryAddressesTab Component
 *
 * Displays and manages delivery addresses for a customer.
 * Shows saved addresses with primary marked, allows add/edit/delete.
 * Includes map preview and geocoding for new addresses.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  MapPin, Plus, Edit, Trash2, Star, Home, Building,
  Loader2, Navigation, ExternalLink
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

interface CustomerDeliveryAddressesTabProps {
  customerId: string;
}

interface DeliveryAddress {
  id: string;
  tenant_id: string;
  customer_id: string;
  label: string;
  street_address: string;
  apartment: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  delivery_instructions: string | null;
  created_at: string;
  updated_at: string;
}

const addressFormSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  street_address: z.string().min(1, 'Street address is required'),
  apartment: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().min(5, 'Valid ZIP code is required'),
  country: z.string().default('US'),
  is_primary: z.boolean().default(false),
  delivery_instructions: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressFormSchema>;

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

function formatFullAddress(address: DeliveryAddress): string {
  const parts = [address.street_address];
  if (address.apartment) {
    parts.push(`Apt ${address.apartment}`);
  }
  parts.push(`${address.city}, ${address.state} ${address.zip_code}`);
  return parts.join(', ');
}

function getAddressIcon(label: string) {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('home')) return <Home className="h-5 w-5" />;
  if (lowerLabel.includes('work') || lowerLabel.includes('office')) return <Building className="h-5 w-5" />;
  return <MapPin className="h-5 w-5" />;
}

export function CustomerDeliveryAddressesTab({ customerId }: CustomerDeliveryAddressesTabProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      label: 'Home',
      street_address: '',
      apartment: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'US',
      is_primary: false,
      delivery_instructions: '',
    },
  });

  // Fetch addresses
  const { data: addresses = [], isLoading, error } = useQuery({
    queryKey: queryKeys.customerDetail.deliveryAddresses(customerId, tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('customer_delivery_addresses')
        .select('id, tenant_id, customer_id, label, street_address, apartment, city, state, zip_code, country, latitude, longitude, is_primary, delivery_instructions, created_at, updated_at')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenant.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch customer addresses', error, {
          component: 'CustomerDeliveryAddressesTab',
          customerId,
        });
        throw error;
      }

      return (data ?? []) as unknown as DeliveryAddress[];
    },
    enabled: !!customerId && !!tenant?.id,
  });

  // Save address mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AddressFormData & { latitude?: number; longitude?: number }) => {
      if (!tenant?.id) throw new Error('Tenant not found');

      const addressData = {
        tenant_id: tenant.id,
        customer_id: customerId,
        label: data.label,
        street_address: data.street_address,
        apartment: data.apartment || null,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        country: data.country || 'US',
        is_primary: data.is_primary,
        delivery_instructions: data.delivery_instructions || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      };

      if (editingAddress) {
        const { error } = await supabase
          .from('customer_delivery_addresses')
          .update(addressData)
          .eq('id', editingAddress.id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customer_delivery_addresses')
          .insert(addressData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDetail.deliveryAddresses(customerId) });
      toast.success(editingAddress ? 'Address updated' : 'Address added');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      logger.error('Failed to save address', error instanceof Error ? error : new Error(String(error)), {
        component: 'CustomerDeliveryAddressesTab',
      });
      toast.error('Failed to save address', {
        description: humanizeError(error),
      });
    },
  });

  // Delete address mutation
  const deleteMutation = useMutation({
    mutationFn: async (addressId: string) => {
      if (!tenant?.id) throw new Error('Tenant not found');

      const { error } = await supabase
        .from('customer_delivery_addresses')
        .delete()
        .eq('id', addressId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDetail.deliveryAddresses(customerId) });
      toast.success('Address deleted');
      setDeleteDialogOpen(false);
      setDeletingAddressId(null);
    },
    onError: (error: Error) => {
      logger.error('Failed to delete address', error instanceof Error ? error : new Error(String(error)), {
        component: 'CustomerDeliveryAddressesTab',
      });
      toast.error('Failed to delete address', {
        description: humanizeError(error),
      });
    },
  });

  // Set primary address mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (addressId: string) => {
      if (!tenant?.id) throw new Error('Tenant not found');

      const { error } = await supabase
        .from('customer_delivery_addresses')
        .update({ is_primary: true })
        .eq('id', addressId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDetail.deliveryAddresses(customerId) });
      toast.success('Primary address updated');
    },
    onError: (error: Error) => {
      logger.error('Failed to set primary address', error instanceof Error ? error : new Error(String(error)), {
        component: 'CustomerDeliveryAddressesTab',
      });
      toast.error('Failed to update primary address', {
        description: humanizeError(error),
      });
    },
  });

  const handleOpenDialog = (address?: DeliveryAddress) => {
    if (address) {
      setEditingAddress(address);
      form.reset({
        label: address.label,
        street_address: address.street_address,
        apartment: address.apartment ?? '',
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        country: address.country,
        is_primary: address.is_primary,
        delivery_instructions: address.delivery_instructions ?? '',
      });
    } else {
      setEditingAddress(null);
      form.reset({
        label: 'Home',
        street_address: '',
        apartment: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'US',
        is_primary: addresses.length === 0,
        delivery_instructions: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAddress(null);
    form.reset();
  };

  const handleDeleteClick = (addressId: string) => {
    setDeletingAddressId(addressId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingAddressId) {
      deleteMutation.mutate(deletingAddressId);
    }
  };

  const handleGeocodeAddress = async () => {
    const values = form.getValues();
    const fullAddress = `${values.street_address}, ${values.city}, ${values.state} ${values.zip_code}`;

    setIsGeocoding(true);
    try {
      // Use OpenStreetMap Nominatim for free geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        toast.success(`Address geocoded: ${lat}, ${lon}`);
        return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      } else {
        toast.info('Could not geocode address - coordinates will be empty');
        return null;
      }
    } catch (error) {
      logger.error('Geocoding failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'CustomerDeliveryAddressesTab',
      });
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  const onSubmit = async (data: AddressFormData) => {
    // Attempt geocoding before saving
    const coords = await handleGeocodeAddress();
    saveMutation.mutate({
      ...data,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    });
  };

  const openInMaps = (address: DeliveryAddress) => {
    const fullAddress = formatFullAddress(address);
    if (address.latitude && address.longitude) {
      window.open(`https://www.google.com/maps?q=${address.latitude},${address.longitude}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`, '_blank', 'noopener,noreferrer');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Delivery Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <MapPin className="h-5 w-5" />
            Error Loading Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Failed to load delivery addresses. Please try again.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.customerDetail.deliveryAddresses(customerId) })}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Delivery Addresses
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToAdmin('delivery-zones')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Delivery Zones
              </Button>
              <Button size="sm" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <EnhancedEmptyState
              icon={MapPin}
              title="No Delivery Addresses"
              description="Add delivery addresses for this customer to use when creating orders."
              primaryAction={{
                label: 'Add First Address',
                onClick: () => handleOpenDialog(),
              }}
              compact
            />
          ) : (
            <div className="space-y-3">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5 text-primary">
                      {getAddressIcon(address.label)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{address.label}</span>
                        {address.is_primary && (
                          <Badge variant="default" className="text-xs gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                        {address.latitude && address.longitude && (
                          <Badge variant="outline" className="text-xs">
                            Geocoded
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {address.street_address}
                        {address.apartment && `, Apt ${address.apartment}`}
                        <br />
                        {address.city}, {address.state} {address.zip_code}
                      </p>
                      {address.delivery_instructions && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Note: {address.delivery_instructions}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    {!address.is_primary && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPrimaryMutation.mutate(address.id)}
                        disabled={setPrimaryMutation.isPending}
                        title="Set as primary"
                        aria-label="Set as primary address"
                      >
                        {setPrimaryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openInMaps(address)}
                      title="Open in Maps"
                      aria-label="Open in Maps"
                    >
                      <Navigation className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(address)}
                      title="Edit address"
                      aria-label="Edit address"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteClick(address.id)}
                      title="Delete address"
                      aria-label="Delete address"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Address Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Address' : 'Add Delivery Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? 'Update the delivery address details below.'
                : 'Enter the delivery address details. The address will be geocoded automatically.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a label" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Home">Home</SelectItem>
                        <SelectItem value="Work">Work</SelectItem>
                        <SelectItem value="Office">Office</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="street_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apartment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apartment / Suite</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt 4B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
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
                      <FormLabel required>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="10001" maxLength={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Gate code, building instructions, etc."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_primary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Set as primary address</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending || isGeocoding}>
                  {(saveMutation.isPending || isGeocoding) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingAddress ? 'Update Address' : 'Add Address'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletingAddressId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Address"
        description="Are you sure you want to delete this address? This action cannot be undone."
        itemType="address"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
