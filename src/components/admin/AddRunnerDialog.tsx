/**
 * Add Runner Dialog
 * Dialog for adding a new delivery runner
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { useQueryClient } from '@tanstack/react-query';

const runnerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
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
  const { toast } = useToast();
  const { account } = useAccount();
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

  const onSubmit = async (data: RunnerFormData) => {
    setIsSubmitting(true);
    try {
      const { data: runner, error } = await supabase
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
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Runner ${data.full_name} added successfully`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      if (account?.id) {
        queryClient.invalidateQueries({ queryKey: ['runners', account.id] });
      }

      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error adding runner:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add runner',
        variant: 'destructive',
      });
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
                  <FormLabel>Full Name *</FormLabel>
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
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="555-123-4567" {...field} />
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
                  <FormLabel>Vehicle Type *</FormLabel>
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
            <div className="flex justify-end gap-2 pt-4">
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
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

