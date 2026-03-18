import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const editDriverSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  display_name: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(20),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

type EditDriverFormValues = z.infer<typeof editDriverSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EditDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DriverProfile;
  tenantId: string;
}

export function EditDriverDialog({ open, onOpenChange, driver, tenantId }: EditDriverDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditDriverFormValues>({
    resolver: zodResolver(editDriverSchema),
    defaultValues: {
      full_name: driver.full_name,
      display_name: driver.display_name ?? '',
      email: driver.email,
      phone: driver.phone,
      notes: driver.notes ?? '',
    },
  });

  // Reset form values when dialog opens or driver data changes
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: driver.full_name,
        display_name: driver.display_name ?? '',
        email: driver.email,
        phone: driver.phone,
        notes: driver.notes ?? '',
      });
    }
  }, [open, driver, form]);

  const updateDriver = useMutation({
    mutationFn: async (values: EditDriverFormValues) => {
      const { error } = await supabase
        .from('couriers')
        .update({
          full_name: values.full_name,
          display_name: values.display_name || null,
          email: values.email,
          phone: values.phone,
          notes: values.notes || null,
        })
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.couriers.detail(driver.id) });
      toast.success('Profile updated');
      handleClose();
    },
    onError: (err) => {
      logger.error('Update driver failed', err);
      toast.error('Failed to update profile');
    },
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(() => {
    form.handleSubmit((values) => updateDriver.mutate(values))();
  }, [form, updateDriver]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px] border-border bg-background p-0 text-foreground">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-semibold text-foreground">Edit Driver Profile</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Update driver contact information and details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="edit-full-name" className="text-xs font-medium text-muted-foreground">
              Full Name
            </label>
            <Input
              id="edit-full-name"
              {...form.register('full_name')}
              className="border-border bg-background text-foreground"
            />
            {form.formState.errors.full_name && (
              <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="edit-display-name" className="text-xs font-medium text-muted-foreground">
              Display Name
            </label>
            <Input
              id="edit-display-name"
              {...form.register('display_name')}
              placeholder="Optional"
              className="border-border bg-background text-foreground"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="edit-email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <Input
              id="edit-email"
              type="email"
              {...form.register('email')}
              className="border-border bg-background text-foreground"
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="edit-phone" className="text-xs font-medium text-muted-foreground">
              Phone
            </label>
            <Input
              id="edit-phone"
              {...form.register('phone')}
              className="border-border bg-background text-foreground"
            />
            {form.formState.errors.phone && (
              <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="edit-notes" className="text-xs font-medium text-muted-foreground">
              Notes
            </label>
            <Textarea
              id="edit-notes"
              {...form.register('notes')}
              placeholder="Internal notes about this driver..."
              rows={3}
              className="border-border bg-background text-foreground"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={updateDriver.isPending}
            className="text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={updateDriver.isPending}
            className="bg-emerald-500 text-sm text-white hover:bg-emerald-600"
          >
            {updateDriver.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
