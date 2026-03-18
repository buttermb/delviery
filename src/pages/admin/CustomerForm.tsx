import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { UnsavedChangesDialog } from '@/components/unsaved-changes';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useEncryption } from '@/lib/hooks/useEncryption';
import type { Database } from '@/integrations/supabase/types';

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
import { queryKeys } from '@/lib/queryKeys';
import { ShortcutHint, useModifierKey } from '@/components/ui/shortcut-hint';
import { useFormKeyboardShortcuts } from '@/hooks/useFormKeyboardShortcuts';
import { useEmailValidation } from '@/hooks/useEmailValidation';

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
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { csrfToken, validateToken } = useCsrfToken();

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

  const emailValue = form.watch('email');
  const emailCheck = useEmailValidation(emailValue);

  const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
    isDirty: form.formState.isDirty,
  });

  const mod = useModifierKey();

  // Load customer data using TanStack Query with tenant_id filtering
  const { isLoading: customerLoading } = useQuery({
    queryKey: queryKeys.customers.detail(tenant?.id ?? '', id ?? ''),
    queryFn: async () => {
      if (!id || !tenant?.id) return null;

      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, date_of_birth, address, customer_type, medical_card_number, medical_card_expiration, status, is_encrypted')
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const customer = data.is_encrypted ? await decryptCustomerData(data) : data;

      if (data.is_encrypted) {
        await logPHIAccess(id, 'view', getPHIFields(), 'Edit form load');
      }

      return customer;
    },
    enabled: isEdit && !!id && !!tenant?.id && !accountLoading,
    staleTime: 30_000,
    retry: 2,
  });

  // Populate form when customer data is loaded
  const customerData = queryClient.getQueryData(
    queryKeys.customers.detail(tenant?.id ?? '', id ?? '')
  ) as Record<string, unknown> | null | undefined;

  useEffect(() => {
    if (customerData && isEdit) {
      form.reset({
        first_name: (customerData.first_name as string) ?? '',
        last_name: (customerData.last_name as string) ?? '',
        email: (customerData.email as string) ?? '',
        phone: (customerData.phone as string) ?? '',
        date_of_birth: (customerData.date_of_birth as string) ?? '',
        address: (customerData.address as string) ?? '',
        customer_type: ((customerData.customer_type as string) || 'recreational') as 'medical' | 'recreational',
        medical_card_number: (customerData.medical_card_number as string) ?? '',
        medical_card_expiration: (customerData.medical_card_expiration as string) ?? '',
        status: ((customerData.status as string) || 'active') as 'active' | 'inactive' | 'suspended',
      });
    }
  }, [customerData, isEdit, form]);

  // Save customer mutation
  const saveMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!validateToken()) {
        throw new Error('Security validation failed. Please refresh the page and try again.');
      }

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (!encryptionIsReady) {
        throw new Error('Encryption not initialized. Please log in again.');
      }

      const customerPayload = {
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

      const encryptedData = await encryptCustomerData(customerPayload);

      if (isEdit && id) {
        const { error } = await supabase
          .from('customers')
          .update(encryptedData as unknown as CustomerUpdate)
          .eq('id', id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        await logPHIAccess(id, 'update', getPHIFields(), 'Customer update');
        return { mode: 'update' as const };
      }

      // Check customer limit for new customers
      const currentCustomers = tenant.usage?.customers ?? 0;
      const customerLimit = tenant.limits?.customers ?? 0;

      if (customerLimit > 0 && currentCustomers >= customerLimit) {
        throw new Error(
          `Customer limit reached. You've reached your customer limit (${currentCustomers}/${customerLimit}). Please upgrade your plan.`
        );
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

      return { mode: 'create' as const };
    },
    onSuccess: (result) => {
      toast.success(result.mode === 'update' ? 'Customer updated successfully' : 'Customer created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.list(tenant?.id) });
      if (isEdit && id && tenant?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(tenant.id, id) });
      }
      navigateToAdmin('customer-management');
    },
    onError: (error: Error) => {
      logger.error('Error saving customer', error, { component: 'CustomerForm' });
      toast.error('Failed to save customer', { description: humanizeError(error) });
    },
  });

  const onSubmit = (values: CustomerFormValues) => {
    saveMutation.mutate(values);
  };

  useFormKeyboardShortcuts({
    onSave: () => form.handleSubmit(onSubmit)(),
    onCancel: () => navigateToAdmin('customer-management'),
  });

  if (accountLoading || customerLoading) {
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
            <input type="hidden" name="csrf_token" value={csrfToken} />
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
                          {emailCheck.isChecked && emailCheck.isDisposable && (
                            <p className="text-sm font-medium text-destructive mt-1">Disposable email addresses are not allowed</p>
                          )}
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
                    disabled={saveMutation.isPending}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {saveMutation.isPending ? (
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
