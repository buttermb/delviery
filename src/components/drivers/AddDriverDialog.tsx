import { useState, useCallback } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { Step1Info } from '@/components/drivers/steps/Step1Info';
import { Step2Vehicle } from '@/components/drivers/steps/Step2Vehicle';
import { Step3Account } from '@/components/drivers/steps/Step3Account';
import { Step4Review } from '@/components/drivers/steps/Step4Review';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const addDriverSchema = z.object({
  // Step 1
  full_name: z.string().min(1, 'Full name is required').max(100),
  display_name: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(20),
  notes: z.string().max(2000).optional().or(z.literal('')),
  // Step 2
  vehicle_type: z.enum(['car', 'van', 'motorcycle', 'bicycle', 'truck']),
  vehicle_make: z.string().min(1, 'Vehicle make is required').max(50),
  vehicle_model: z.string().min(1, 'Vehicle model is required').max(50),
  vehicle_year: z.coerce.number().int().min(1990).max(2030),
  vehicle_color: z.string().min(1, 'Vehicle color is required').max(30),
  vehicle_plate: z.string().min(1, 'License plate is required').max(20),
  
  // Step 3
  commission_rate: z.number().min(0).max(100).default(30),
  zone_id: z.string().optional().or(z.literal('')),
  send_invite_email: z.boolean().default(true),
});

export type AddDriverFormValues = z.infer<typeof addDriverSchema>;

export type AddDriverForm = UseFormReturn<AddDriverFormValues>;

// ---------------------------------------------------------------------------
// Step field map (for per-step validation)
// ---------------------------------------------------------------------------

const STEP_FIELDS: Record<number, (keyof AddDriverFormValues)[]> = {
  1: ['full_name', 'email', 'phone'],
  2: ['vehicle_type', 'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color', 'vehicle_plate'],
  3: ['commission_rate'],
};

// ---------------------------------------------------------------------------
// Steps config
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Info', step: 1 },
  { label: 'Vehicle', step: 2 },
  { label: 'Account', step: 3 },
  { label: 'Review', step: 4 },
] as const;

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function StepProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      {STEPS.map(({ label, step }, i) => {
        const isCompleted = currentStep > step;
        const isActive = currentStep === step;
        const isPending = currentStep < step;

        return (
          <div key={step} className="flex items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-card text-muted-foreground ring-1 ring-border'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isPending ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`mx-3 h-[2px] w-12 sm:w-20 ${
                  currentStep > step ? 'bg-emerald-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AddDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDriverDialog({ open, onOpenChange }: AddDriverDialogProps) {
  const { tenant, token } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [previewPin, setPreviewPin] = useState(() => generatePreviewPin());

  const form = useForm<AddDriverFormValues>({
    resolver: zodResolver(addDriverSchema),
    defaultValues: {
      full_name: '',
      display_name: '',
      email: '',
      phone: '',
      notes: '',
      vehicle_type: 'car',
      vehicle_make: '',
      vehicle_model: '',
      vehicle_year: new Date().getFullYear(),
      vehicle_color: '',
      vehicle_plate: '',
      
      commission_rate: 30,
      zone_id: '',
      send_invite_email: true,
    },
  });

  const createDriver = useMutation({
    mutationFn: async (values: AddDriverFormValues) => {
      const body = {
        full_name: values.full_name,
        display_name: values.display_name || undefined,
        email: values.email,
        phone: values.phone,
        notes: values.notes || undefined,
        vehicle_type: values.vehicle_type,
        vehicle_make: values.vehicle_make,
        vehicle_model: values.vehicle_model,
        vehicle_year: values.vehicle_year,
        vehicle_color: values.vehicle_color,
        vehicle_plate: values.vehicle_plate,
        
        commission_rate: values.commission_rate,
        zone_id: values.zone_id || undefined,
        send_invite_email: values.send_invite_email,
      };

      const res = await supabase.functions.invoke('add-driver', {
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.error) throw res.error;

      const data = res.data as { success: boolean; driver_id: string; pin: string; email_sent: boolean; error?: string; code?: string } | null;
      if (!data) throw new Error('Invalid response from server');
      if (!data.success) throw new Error(data.error ?? 'Failed to create driver');
      return data;
    },
    onSuccess: (data, values) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenant?.id) });
      const name = values.display_name || values.full_name;
      toast.success(`${name} added.${data.email_sent ? ' Invite sent.' : ''}`, {
        action: {
          label: 'View Profile',
          onClick: () => navigateToAdmin(`drivers/${data.driver_id}`),
        },
      });
      handleClose();
    },
    onError: (error) => {
      logger.error('Create driver failed', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create driver');
    },
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset after animation completes
    setTimeout(() => {
      form.reset();
      setStep(1);
      setPreviewPin(generatePreviewPin());
      createDriver.reset();
    }, 200);
  }, [onOpenChange, form, createDriver]);

  const handleNext = useCallback(async () => {
    const fields = STEP_FIELDS[step];
    if (fields) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 4));
  }, [step, form]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleSubmit = useCallback(() => {
    form.handleSubmit((values) => createDriver.mutate(values))();
  }, [form, createDriver]);

  const regeneratePin = useCallback(() => {
    setPreviewPin(generatePreviewPin());
  }, []);

  const tenantId = tenant?.id ?? '';

  let stepComponent: React.ReactNode = null;
  switch (step) {
    case 1: stepComponent = <Step1Info form={form} tenantId={tenantId} />; break;
    case 2: stepComponent = <Step2Vehicle form={form} />; break;
    case 3: stepComponent = <Step3Account form={form} tenantId={tenantId} previewPin={previewPin} onRegeneratePin={regeneratePin} />; break;
    case 4: stepComponent = <Step4Review form={form} previewPin={previewPin} isSubmitting={createDriver.isPending} isSuccess={createDriver.isSuccess} onGoToStep={setStep} />; break;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[640px] overflow-hidden border-border bg-background p-0 text-foreground">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-semibold text-foreground">Add Driver</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create a new driver account and configure their profile.
          </DialogDescription>
        </DialogHeader>

        <StepProgressBar currentStep={step} />

        <div className="max-h-[calc(85vh-220px)] min-h-[380px] overflow-y-auto px-6 pb-2">
          {stepComponent}
        </div>

        {/* Footer */}
        {!createDriver.isSuccess && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={step === 1 ? handleClose : handleBack}
              disabled={createDriver.isPending}
              className="text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 4 ? (
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-emerald-500 text-sm text-white hover:bg-emerald-600"
              >
                Next
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createDriver.isPending}
                className="bg-emerald-500 text-sm text-white hover:bg-emerald-600"
              >
                {createDriver.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  'Create Driver & Send Invite'
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePreviewPin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}
