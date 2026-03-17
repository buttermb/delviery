import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { AddDriverForm } from '@/components/drivers/AddDriverDialog';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Step1InfoProps {
  form: AddDriverForm;
  tenantId: string;
}

export function Step1Info({ form, tenantId }: Step1InfoProps) {
  const { register, watch, formState: { errors }, setError, clearErrors } = form;
  const fullName = watch('full_name');
  const email = watch('email');
  const debouncedEmail = useDebounce(email, 500);

  const [duplicateDriverId, setDuplicateDriverId] = useState<string | null>(null);

  // Check for duplicate email
  useQuery({
    queryKey: queryKeys.driverEmailCheck.check(debouncedEmail, tenantId),
    queryFn: async () => {
      if (!debouncedEmail || !debouncedEmail.includes('@')) return null;

      const { data, error } = await supabase
        .from('couriers')
        .select('id')
        .eq('email', debouncedEmail)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Email duplicate check failed', error);
        return null;
      }

      if (data) {
        setDuplicateDriverId(data.id);
        setError('email', {
          type: 'manual',
          message: 'A driver with this email already exists.',
        });
      } else {
        setDuplicateDriverId(null);
        if (errors.email?.type === 'manual') {
          clearErrors('email');
        }
      }

      return data;
    },
    enabled: !!debouncedEmail && debouncedEmail.includes('@') && !!tenantId,
  });

  const initials = getInitials(fullName || '');

  const handleRemoveAvatar = useCallback(() => {
    // Placeholder for avatar upload removal
  }, []);

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card ring-2 ring-border">
          {initials ? (
            <span className="font-['Space_Grotesk'] text-xl font-bold text-muted-foreground">
              {initials}
            </span>
          ) : (
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
        </div>
        {initials && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="text-[11px] text-destructive hover:underline"
          >
            Remove
          </button>
        )}
      </div>

      {/* Full Name */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground" required>
          Full Name
        </Label>
        <Input
          {...register('full_name')}
          placeholder="Marcus Thompson"
          error={!!errors.full_name}
          className="h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
        />
        {errors.full_name && (
          <p className="mt-1 text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground" required>
          Phone
        </Label>
        <div className="flex gap-2">
          <div className="flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3">
            <span className="text-sm">🇺🇸</span>
            <span className="text-xs text-muted-foreground">+1</span>
          </div>
          <Input
            {...register('phone')}
            placeholder="(555) 123-4567"
            type="tel"
            error={!!errors.phone}
            className="h-10 min-h-0 flex-1 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
          />
        </div>
        {errors.phone && (
          <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground" required>
          Email
        </Label>
        <Input
          {...register('email')}
          placeholder="marcus@example.com"
          type="email"
          error={!!errors.email}
          className={`h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 ${
            errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-destructive">
            {errors.email.message}
            {duplicateDriverId && (
              <>
                {' '}
                <button
                  type="button"
                  className="font-medium underline hover:text-destructive/80"
                >
                  View existing driver →
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {/* Display Name */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground">
          Display Name
        </Label>
        <Input
          {...register('display_name')}
          placeholder="Optional — shown to customers"
          className="h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
        />
      </div>

      {/* Notes */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground">
          Notes
        </Label>
        <Textarea
          {...register('notes')}
          placeholder="Internal notes about this driver..."
          rows={2}
          className="min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
        />
      </div>
    </div>
  );
}
