/**
 * Address Book Component
 * Manage saved delivery addresses
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Edit, Trash2, MapPin, Home, 
  Building, CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  borough: string;
  is_primary: boolean;
  apt?: string;
}

export default function AddressBook() {
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    label: 'Home',
    address: '',
    apt: '',
    city: 'New York',
    state: 'NY',
    zip: '',
    borough: '',
    is_primary: false
  });

  const handleSave = async () => {
    if (!formData.address || !formData.zip) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    // Here you would save to database
    const newAddress: Address = {
      id: editing?.id || Math.random().toString(),
      ...formData,
      state: 'NY',
      is_primary: addresses.length === 0 || formData.is_primary
    };

    if (editing) {
      setAddresses(addresses.map(a => a.id === editing.id ? newAddress : a));
      toast({ title: 'Address updated' });
    } else {
      setAddresses([...addresses, newAddress]);
      toast({ title: 'Address saved' });
    }

    setFormData({
      label: 'Home',
      address: '',
      apt: '',
      city: 'New York',
      state: 'NY',
      zip: '',
      borough: '',
      is_primary: false
    });
    setEditing(null);
    setShowDialog(false);
  };

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
    toast({ title: 'Address deleted' });
  };

  const handleEdit = (address: Address) => {
    setEditing(address);
    setFormData({
      label: address.label,
      address: address.address,
      apt: address.apt || '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      borough: address.borough,
      is_primary: address.is_primary
    });
    setShowDialog(true);
  };

  const getIcon = (label: string) => {
    if (label.toLowerCase().includes('home')) return <Home className="h-5 w-5" />;
    if (label.toLowerCase().includes('work') || label.toLowerCase().includes('office')) return <Work className="h-5 w-5" />;
    return <Building className="h-5 w-5" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Saved Addresses
            </CardTitle>
            <CardDescription>
              Manage your delivery addresses
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => {
                setEditing(null);
                setFormData({
                  label: 'Home',
                  address: '',
                  apt: '',
                  city: 'New York',
                  state: 'NY',
                  zip: '',
                  borough: '',
                  is_primary: false
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit' : 'Add'} Address</DialogTitle>
                <DialogDescription className="sr-only">
                  {editing ? 'Edit your saved delivery address' : 'Add a new delivery address to your account'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="label">Address Label</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="Home, Work, etc."
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
                <div>
                  <Label htmlFor="apt">Apt / Suite (Optional)</Label>
                  <Input
                    id="apt"
                    value={formData.apt}
                    onChange={(e) => setFormData({ ...formData, apt: e.target.value })}
                    placeholder="Apt 4B"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      disabled
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zip">ZIP Code *</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      placeholder="10001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="borough">Borough</Label>
                    <Input
                      id="borough"
                      value={formData.borough}
                      onChange={(e) => setFormData({ ...formData, borough: e.target.value })}
                      placeholder="Manhattan"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editing ? 'Update' : 'Save'} Address
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {addresses.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No saved addresses yet
            </p>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Address
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 text-primary">
                    {getIcon(address.label)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{address.label}</span>
                      {address.is_primary && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {address.address}{address.apt && `, ${address.apt}`}
                      <br />
                      {address.city}, {address.state} {address.zip}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(address)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(address.id)}
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
  );
}

