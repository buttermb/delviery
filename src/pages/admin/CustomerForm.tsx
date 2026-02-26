import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { UnsavedChangesDialog } from '@/components/unsaved-changes';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useEncryption } from '@/lib/hooks/useEncryption';
import { Database } from '@/integrations/supabase/types';

type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];
import { encryptCustomerData, decryptCustomerData, logPHIAccess, getPHIFields } from '@/lib/utils/customerEncryption';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { logger } from '@/lib/logger';
import { ShortcutHint, useModifierKey } from '@/components/ui/shortcut-hint';
import { useFormKeyboardShortcuts } from '@/hooks/useFormKeyboardShortcuts';

const customerFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name must be 100 characters or less'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name must be 100 characters or less'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  phone: z.string()
    .regex(/^[\d\s\-+()]+$/, "Invalid phone number")
    .min(7, "Phone number must be at least 7 characters")
    .max(20, "Phone number must be 20 characters or less")
    .or(z.literal(''))
    .optional(),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  address: z.string().max(500, 'Address must be 500 characters or less').optional().or(z.literal('')),
  customer_type: z.enum(['recreational', 'medical']),
  medical_card_number: z.string().max(50, 'Medical card number must be 50 characters or less').optional().or(z.literal('')),
  medical_card_expiration: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const { isReady: encryptionIsReady } = useEncryption();
  const isEdit = !!id;

  const [saving, setSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      address: '',
      customer_type: 'recreational',
      medical_card_number: '',
      medical_card_expiration: '',
      status: 'active',
    },
    mode: 'onBlur',
  });

  const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
    isDirty: form.formState.isDirty,
  });

  const mod = useModifierKey();

  useEffect(() => {
    if (isEdit && id && !accountLoading) {
      loadCustomer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const customer = data.is_encrypted ? await decryptCustomerData(data) : data;

        if (data.is_encrypted) {
          await logPHIAccess(id, 'view', getPHIFields(), 'Edit form load');
        }

        form.reset({
          first_name: customer.first_name ?? '',
          last_name: customer.last_name ?? '',
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          date_of_birth: customer.date_of_birth ?? '',
          address: customer.address ?? '',
          customer_type: (customer.customer_type || 'recreational') as 'medical' | 'recreational',
          medical_card_number: customer.medical_card_number ?? '',
          medical_card_expiration: customer.medical_card_expiration ?? '',
          status: (customer.status || 'active') as 'active' | 'inactive' | 'suspended',
        });
      }
    } catch (error) {
      logger.error('Error loading customer', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerForm' });
      toast.error('Failed to load customer data', { description: humanizeError(error) });
    } finally {
      setPageLoading(false);
    }
  };

  const onSubmit = async (values: CustomerFormValues) => {
    if (!tenant) {
      toast.error('Tenant not found');
      return;
    }

    if (!encryptionIsReady) {
      toast.error('Encryption not initialized. Please log in again.');
      return;
    }

    try {
      setSaving(true);

      const customerData = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || null,
        address: values.address || null,
        city: null,
        state: null,
        zip_code: null,
        tenant_id: tenant.id,
        account_id: tenant.id,
        date_of_birth: values.date_of_birth || null,
        customer_type: values.customer_type,
        medical_card_number: values.medical_card_number || null,
        medical_card_expiration: values.medical_card_expiration || null,
        status: values.status,
        total_spent: 0,
        loyalty_points: 0,
        loyalty_tier: 'bronze',
      };

      const encryptedData = await encryptCustomerData(customerData);

      if (isEdit && id) {
        const { error } = await supabase
          .from('customers')
          .update(encryptedData as unknown as CustomerUpdate)
          .eq('id', id);

        if (error) throw error;

        await logPHIAccess(id, 'update', getPHIFields(), 'Customer update');
        toast.success('Customer updated successfully');
      } else {
        const currentCustomers = tenant.usage?.customers ?? 0;
        const customerLimit = tenant.limits?.customers ?? 0;

        if (customerLimit > 0 && currentCustomers >= customerLimit) {
          toast.error('Customer limit reached', {
            description: `You've reached your customer limit (${currentCustomers}/${customerLimit}). Please upgrade your plan.`,
          });
          return;
        }

        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert([encryptedData as unknown as CustomerInsert])
          .select()
          .maybeSingle();

        if (error) throw error;

        if (newCustomer) {
          await logPHIAccess(newCustomer.id, 'create', getPHIFields(), 'Customer creation');
        }

        const currentUsage = tenant.usage || { customers: 0, menus: 0, products: 0, locations: 0, users: 0 };
        await supabase
          .from('tenants')
          .update({
            usage: {
              ...currentUsage,
              customers: (currentUsage.customers ?? 0) + 1,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id);

        toast.success('Customer created successfully');
      }

      navigateToAdmin('customer-management');
    } catch (error) {
      logger.error('Error saving customer', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerForm' });
      toast.error('Failed to save customer', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setSaving(false);
    }
  };

  useFormKeyboardShortcuts({
    onSave: () => form.handleSubmit(onSubmit)(),
    onCancel: () => navigateToAdmin('customer-management'),
  });

  if (accountLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <SEOHead
          title={isEdit ? 'Edit Customer' : 'Add Customer'}
          description="Customer form"
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigateToAdmin('customer-management')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {isEdit ? 'Edit Customer' : 'Add New Customer'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEdit ? 'Update customer information' : 'Create a new customer profile'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" autoFocus maxLength={100} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" maxLength={100} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="(555) 123-4567" maxLength={20} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Input placeholder="123 Main St" maxLength={500} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Customer Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customer_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="recreational">Recreational</SelectItem>
                            <SelectItem value="medical">Medical</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('customer_type') === 'medical' && (
                    <div className="space-y-4 pt-4 border-t">
                      <FormField
                        control={form.control}
                        name="medical_card_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Medical Card Number</FormLabel>
                            <FormControl>
                              <Input maxLength={50} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="medical_card_expiration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Card Expiration Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-4 justify-end pt-4">
                <ShortcutHint keys={["Esc"]} label="Cancel">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigateToAdmin('customer-management')}
                  >
                    Cancel
                  </Button>
                </ShortcutHint>
                <ShortcutHint keys={[mod, "S"]} label="Save">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {isEdit ? 'Update Customer' : 'Create Customer'}
                      </>
                    )}
                  </Button>
                </ShortcutHint>
              </div>
            </div>
          </form>
        </Form>

        <UnsavedChangesDialog
          open={showBlockerDialog}
          onConfirmLeave={confirmLeave}
          onCancelLeave={cancelLeave}
        />
      </div>
    </div>
  );
}
