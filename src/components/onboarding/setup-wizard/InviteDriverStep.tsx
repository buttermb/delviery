/**
 * Setup Wizard Step 4: Invite First Driver
 * Simple form to invite a delivery driver
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Truck, Loader2, CheckCircle2, Send } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

const driverSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  vehicle_type: z.string().min(1, 'Vehicle type is required'),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface InviteDriverStepProps {
  onComplete: () => void;
}

export function InviteDriverStep({ onComplete }: InviteDriverStepProps) {
  const { tenant } = useTenantAdminAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitedDriver, setInvitedDriver] = useState<string | null>(null);

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      vehicle_type: '',
    },
  });

  const onSubmit = async (data: DriverFormData) => {
    if (!tenant?.id) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('wholesale_runners')
        .insert({
          tenant_id: tenant.id,
          full_name: data.full_name,
          phone: data.phone,
          email: data.email || null,
          vehicle_type: data.vehicle_type,
          status: 'active',
        });

      if (error) throw error;

      setInvitedDriver(data.full_name);
      toast.success(`Driver "${data.full_name}" added!`);
    } catch (error) {
      logger.error('Failed to invite driver', error instanceof Error ? error : new Error(String(error)), { component: 'InviteDriverStep' });
      toast.error('Failed to add driver. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl">
          <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Invite Your First Driver</h3>
          <p className="text-sm text-muted-foreground">Add a delivery driver to your team</p>
        </div>
      </div>

      {invitedDriver ? (
        <div className="space-y-4">
          <div className="p-6 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-green-700 dark:text-green-300">
              Driver Invited!
            </h4>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {invitedDriver} has been added to your delivery team.
            </p>
          </div>
          <Button onClick={onComplete} className="w-full">
            Continue to Next Step
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                  <FormLabel required>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 123-4567" {...field} />
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
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="driver@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicle_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Vehicle Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="bicycle">Bicycle</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Driver...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Add Driver
                </>
              )}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
