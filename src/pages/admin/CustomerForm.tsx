import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth, Tenant } from '@/contexts/TenantAdminAuthContext';
import { useEncryption } from '@/lib/hooks/useEncryption';
import { Database } from '@/integrations/supabase/types';

type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];
import { encryptCustomerData, decryptCustomerData, logPHIAccess, getPHIFields } from '@/lib/utils/customerEncryption';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant, admin, loading: accountLoading } = useTenantAdminAuth();
  const { isReady: encryptionIsReady } = useEncryption();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    address: '',
    customer_type: 'recreational',
    medical_card_number: '',
    medical_card_expiration: '',
    status: 'active'
  });

  useEffect(() => {
    if (isEdit && id && !accountLoading) {
      loadCustomer();
    }
  }, [isEdit, id, accountLoading]);

  const loadCustomer = async () => {
    if (!id) return;

    try {
      setPageLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Decrypt customer data if encrypted
        const customer = data.is_encrypted ? await decryptCustomerData(data) : data;

        // Log PHI access for HIPAA compliance
        if (data.is_encrypted) {
          await logPHIAccess(id, 'view', getPHIFields(), 'Edit form load');
        }

        setFormData({
          first_name: customer.first_name || '',
          last_name: customer.last_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          date_of_birth: customer.date_of_birth || '',
          address: customer.address || '',
          customer_type: customer.customer_type || 'recreational',
          medical_card_number: customer.medical_card_number || '',
          medical_card_expiration: customer.medical_card_expiration || '',
          status: customer.status || 'active'
        });
      }
    } catch (error) {
      logger.error('Error loading customer', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerForm' });
      toast.error('Failed to load customer data');
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant) {
      toast.error('Tenant not found');
      return;
    }

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      if (!encryptionIsReady) {
        toast.error('Encryption not initialized. Please log in again.');
        return;
      }

      // Prepare customer data for encryption
      const customerData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        address: formData.address || null,
        city: null,
        state: null,
        zip_code: null,
        tenant_id: tenant.id,
        account_id: tenant.id, // Using tenant as account
        date_of_birth: formData.date_of_birth || null,
        customer_type: formData.customer_type,
        medical_card_number: formData.medical_card_number || null,
        medical_card_expiration: formData.medical_card_expiration || null,
        status: formData.status,
        total_spent: 0,
        loyalty_points: 0,
        loyalty_tier: 'bronze'
      };

      // Encrypt customer data
      const encryptedData = await encryptCustomerData(customerData);

      if (isEdit && id) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update(encryptedData as unknown as CustomerUpdate)
          .eq('id', id);

        if (error) throw error;

        // Log PHI update
        await logPHIAccess(id, 'update', getPHIFields(), 'Customer update');

        toast.success('Customer updated successfully');
      } else {
        // Check tenant limits before creating
        const currentCustomers = tenant.usage?.customers || 0;
        const customerLimit = tenant.limits?.customers || 0;

        if (customerLimit > 0 && currentCustomers >= customerLimit) {
          toast.error('Customer limit reached', {
            description: `You've reached your customer limit (${currentCustomers}/${customerLimit}). Please upgrade your plan.`,
          });
          return;
        }

        // Create new customer
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert([encryptedData as unknown as CustomerInsert])
          .select()
          .maybeSingle();

        if (error) throw error;

        // Log PHI creation
        if (newCustomer) {
          await logPHIAccess(newCustomer.id, 'create', getPHIFields(), 'Customer creation');
        }

        // Update usage count
        const currentUsage = tenant.usage || { customers: 0, menus: 0, products: 0, locations: 0, users: 0 };
        await supabase
          .from('tenants')
          .update({
            usage: {
              ...currentUsage,
              customers: (currentUsage.customers || 0) + 1,
            },
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', tenant.id);

        toast.success('Customer created successfully');
      }

      navigateToAdmin('customer-management');
    } catch (error) {
      logger.error('Error saving customer', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerForm' });
      toast.error('Failed to save customer', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (accountLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <SEOHead
          title={isEdit ? 'Edit Customer' : 'Add Customer'}
          description="Customer form"
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigateToAdmin('customer-management')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEdit ? 'Edit Customer' : 'Add New Customer'}
              </h1>
              <p className="text-gray-500 mt-1">
                {isEdit ? 'Update customer information' : 'Create a new customer profile'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Information */}
            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth *</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleChange('date_of_birth', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleChange('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Customer Type */}
            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Customer Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_type">Type</Label>
                  <Select
                    value={formData.customer_type}
                    onValueChange={(value) => handleChange('customer_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recreational">Recreational</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.customer_type === 'medical' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="medical_card_number">Medical Card Number</Label>
                      <Input
                        id="medical_card_number"
                        value={formData.medical_card_number}
                        onChange={(e) => handleChange('medical_card_number', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medical_card_expiration">Card Expiration Date</Label>
                      <Input
                        id="medical_card_expiration"
                        type="date"
                        value={formData.medical_card_expiration}
                        onChange={(e) => handleChange('medical_card_expiration', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateToAdmin('customer-management')}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {loading ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isEdit ? 'Update Customer' : 'Create Customer'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
