/**
 * Quick Create Customer Dialog
 * Simplified customer creation for POS - minimal fields for fast checkout
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Loader2, UserPlus } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { encryptCustomerData, logPHIAccess, getPHIFields } from '@/lib/utils/customerEncryption';
import { useEncryption } from '@/lib/hooks/useEncryption';
import type { POSCustomer } from './POSCustomerSelector';

const formSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  customer_type: z.enum(['recreational', 'medical']),
});

type FormValues = z.infer<typeof formSchema>;

interface QuickCreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess: (customer: POSCustomer) => void;
  initialName?: string;
}

export function QuickCreateCustomerDialog({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
  initialName = '',
}: QuickCreateCustomerDialogProps) {
  const queryClient = useQueryClient();
  const { isReady: encryptionIsReady } = useEncryption();

  // Parse initial name into first/last
  const parseInitialName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        first_name: parts[0],
        last_name: parts.slice(1).join(' '),
      };
    }
    return {
      first_name: parts[0] || '',
      last_name: '',
    };
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      customer_type: 'recreational',
    },
  });

  // Update form when initialName changes
  useEffect(() => {
    if (open && initialName) {
      const { first_name, last_name } = parseInitialName(initialName);
      form.setValue('first_name', first_name);
      form.setValue('last_name', last_name);
    }
  }, [open, initialName, form]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const createCustomer = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!encryptionIsReady) {
        throw new Error('Encryption not initialized');
      }

      // Prepare customer data
      const customerData = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        tenant_id: tenantId,
        account_id: tenantId,
        date_of_birth: null,
        customer_type: values.customer_type,
        medical_card_number: null,
        medical_card_expiration: null,
        status: 'active',
        total_spent: 0,
        loyalty_points: 0,
        loyalty_tier: 'bronze',
      };

      // Encrypt customer data
      const encryptedData = await encryptCustomerData(customerData);

      // Insert customer
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert(encryptedData)
        .select('id, first_name, last_name, customer_type, loyalty_points, email, phone')
        .single();

      if (error) throw error;

      // Log PHI creation
      if (data) {
        await logPHIAccess(data.id, 'create', getPHIFields(), 'POS quick create');
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate customer queries
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      toast.success('Customer created', {
        description: `${data.first_name} ${data.last_name} added successfully`,
      });

      // Call success callback with the new customer
      onSuccess({
        id: data.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        customer_type: data.customer_type || 'recreational',
        loyalty_points: data.loyalty_points || 0,
        email: data.email,
        phone: data.phone,
      });
    },
    onError: (error) => {
      logger.error('Failed to create customer', error, {
        component: 'QuickCreateCustomerDialog',
        tenantId,
      });
      toast.error('Failed to create customer', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    createCustomer.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Quick Add Customer
          </DialogTitle>
          <DialogDescription>
            Add a new customer for this transaction. You can add more details later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" autoFocus {...field} />
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
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 123-4567" type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
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

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createCustomer.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
