/**
 * Add Runner Dialog
 * Dialog for adding a new delivery runner
 */

import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAccount } from '@/contexts/AccountContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const runnerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[\d\s\-+()]+$/, "Invalid phone number").min(7, "Phone number must be at least 7 characters").max(20, "Phone number must be 20 characters or less"),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  vehicle_type: z.string().min(1, 'Vehicle type is required'),
  vehicle_plate: z.string().optional(),
});

type RunnerFormData = z.infer<typeof runnerSchema>;

interface AddRunnerDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function AddRunnerDialog({ onSuccess, trigger }: AddRunnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { account: _account } = useAccount();
  const queryClient = useQueryClient();

  const form = useForm<RunnerFormData>({
    resolver: zodResolver(runnerSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      vehicle_type: '',
      vehicle_plate: '',
    },
  });

  // Reset form when dialog closes without submit
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: RunnerFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('wholesale_runners')
        .insert({
          full_name: data.full_name,
          phone: data.phone,
          email: data.email || null,
          vehicle_type: data.vehicle_type,
          vehicle_plate: data.vehicle_plate || null,
          status: 'available',
          total_deliveries: 0,
          rating: 5.0,
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      toast.success(`Runner ${data.full_name} added successfully`);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.all });

      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      logger.error('Error adding runner', error as Error, { component: 'AddRunnerDialog' });
      toast.error(humanizeError(error, 'Failed to add runner'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Runner
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Runner</DialogTitle>
          <DialogDescription>
            Add a new delivery runner to your fleet
          </DialogDescription>
        </DialogHeader>
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
                    <Input type="tel" placeholder="555-123-4567" {...field} />
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
                    <Input type="email" placeholder="john@example.com" {...field} />
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
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicle_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Plate (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC-1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Runner
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

