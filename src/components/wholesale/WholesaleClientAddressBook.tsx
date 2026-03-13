/**
 * Wholesale Client Address Book Component
 * Manage multiple shipping/billing addresses for wholesale clients
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Address {
  id: string;
  label: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default: boolean;
  address_type: 'shipping' | 'billing' | 'both';
}

interface WholesaleClientAddressBookProps {
  clientId: string;
}

export function WholesaleClientAddressBook({ clientId }: WholesaleClientAddressBookProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['client-addresses', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_addresses')
        .select('*')
        .eq('client_id', clientId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as Address[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase
        .from('client_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Address deleted');
      queryClient.invalidateQueries({ queryKey: ['client-addresses', clientId] });
    },
    onError: (error) => {
      logger.error('Failed to delete address', { error });
      toast.error('Failed to delete address');
    },
  });

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAddress(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Address Book
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </DialogTitle>
            </DialogHeader>
            <AddressForm
              clientId={clientId}
              address={editingAddress}
              onSuccess={() => {
                setIsDialogOpen(false);
                setEditingAddress(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {addresses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No addresses saved</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{address.label}</h4>
                    {address.is_default && (
                      <Badge variant="default" className="text-xs">Default</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {address.address_type}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(address)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(address.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {address.street_address}
                  <br />
                  {address.city}, {address.state} {address.zip_code}
                  <br />
                  {address.country}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddressForm({
  clientId,
  address,
  onSuccess,
}: {
  clientId: string;
  address: Address | null;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    label: address?.label || '',
    street_address: address?.street_address || '',
    city: address?.city || '',
    state: address?.state || '',
    zip_code: address?.zip_code || '',
    country: address?.country || 'USA',
    is_default: address?.is_default || false,
    address_type: address?.address_type || 'both' as 'shipping' | 'billing' | 'both',
  });

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (address) {
        const { error } = await supabase
          .from('client_addresses')
          .update(formData)
          .eq('id', address.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_addresses')
          .insert({ ...formData, client_id: clientId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(address ? 'Address updated' : 'Address added');
      queryClient.invalidateQueries({ queryKey: ['client-addresses', clientId] });
      onSuccess();
    },
    onError: (error) => {
      logger.error('Failed to save address', { error });
      toast.error('Failed to save address');
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          placeholder="e.g., Main Warehouse, HQ"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">Street Address</Label>
        <Input
          id="street"
          value={formData.street_address}
          onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP Code</Label>
          <Input
            id="zip"
            value={formData.zip_code}
            onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="default"
          checked={formData.is_default}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, is_default: checked as boolean })
          }
        />
        <Label htmlFor="default" className="cursor-pointer">
          Set as default address
        </Label>
      </div>

      <Button
        className="w-full"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? 'Saving...' : address ? 'Update Address' : 'Add Address'}
      </Button>
    </div>
  );
}
