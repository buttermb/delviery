import { useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const signupSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .transform((val) => val.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must include uppercase, lowercase, and a number'
    ),
  fullName: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .transform((val) => val.trim()),
  phone: z.string()
    .regex(/^[\d\s\-()+]*$/, 'Phone number contains invalid characters')
    .max(20, 'Phone number is too long')
    .optional()
    .or(z.literal('')),
  tenantSlug: z.string()
    .min(2, 'Tenant slug must be at least 2 characters')
    .max(63, 'Tenant slug must be less than 63 characters')
    .regex(/^[a-z0-9-]+$/, 'Tenant slug can only contain lowercase letters, numbers, and hyphens')
    .transform((val) => val.toLowerCase().trim()),
});

// ============================================================================
// TYPES
// ============================================================================

export type SignupInput = z.input<typeof signupSchema>;
export type ValidatedSignupInput = z.output<typeof signupSchema>;

export interface SignupResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  session?: {
    access_token: string;
    refresh_token: string;
  };
  error?: string;
}

export interface SignupValidationError {
  field: string;
  message: string;
}

export interface UseSignupReturn {
  signup: (input: SignupInput) => void;
  signupAsync: (input: SignupInput) => Promise<SignupResponse>;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  validationErrors: SignupValidationError[];
  reset: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function clearSensitiveString(value: string): void {
  // Overwrite the string content by creating a same-length replacement
  // Note: JS strings are immutable, but we null out references to allow GC
  if (value && value.length > 0) {
    try {
      // Force the string to be eligible for garbage collection
      // by removing all references
      value = '';
    } catch {
      // Best-effort clearing
    }
  }
}

function clearSensitiveData(input: Record<string, unknown>): void {
  // Overwrite sensitive fields in the mutable object
  if ('password' in input) {
    input.password = '';
  }
  if ('email' in input) {
    input.email = '';
  }
  if ('phone' in input) {
    input.phone = '';
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSignup(): UseSignupReturn {
  const validationErrorsRef = useRef<SignupValidationError[]>([]);

  const mutation = useMutation<SignupResponse, Error, SignupInput>({
    mutationFn: async (input: SignupInput): Promise<SignupResponse> => {
      // Clear previous validation errors
      validationErrorsRef.current = [];

      // Client-side validation with zod
      const parseResult = signupSchema.safeParse(input);

      if (!parseResult.success) {
        const errors: SignupValidationError[] = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        validationErrorsRef.current = errors;

        const errorMessage = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
        throw new Error(`Validation failed: ${errorMessage}`);
      }

      const validated = parseResult.data;

      try {
        // Call auth-signup edge function
        const { data, error } = await supabase.functions.invoke<SignupResponse>('auth-signup', {
          body: {
            email: validated.email,
            password: validated.password,
            fullName: validated.fullName,
            phone: validated.phone || undefined,
            tenantSlug: validated.tenantSlug,
          },
        });

        if (error) {
          logger.error('[useSignup] Edge function invocation error', error);
          throw new Error(error.message || 'Signup request failed');
        }

        if (!data) {
          throw new Error('No response received from signup service');
        }

        // Check for error in response body
        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.success) {
          throw new Error('Signup failed. Please try again.');
        }

        return data;
      } finally {
        // Clear sensitive data from the validated object after use
        clearSensitiveData(validated as unknown as Record<string, unknown>);
        clearSensitiveData(input as unknown as Record<string, unknown>);
      }
    },
    onError: (error: Error) => {
      logger.error('[useSignup] Signup failed', error);
    },
    onSuccess: (data) => {
      logger.info('[useSignup] Signup successful', { userId: data.user?.id });
    },
  });

  const reset = useCallback(() => {
    validationErrorsRef.current = [];
    mutation.reset();
  }, [mutation]);

  const signup = useCallback(
    (input: SignupInput) => {
      // Create a mutable copy to allow clearing after mutation
      const mutableInput = { ...input };
      mutation.mutate(mutableInput);
    },
    [mutation]
  );

  const signupAsync = useCallback(
    async (input: SignupInput): Promise<SignupResponse> => {
      const mutableInput = { ...input };
      return mutation.mutateAsync(mutableInput);
    },
    [mutation]
  );

  return {
    signup,
    signupAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error?.message ?? null,
    validationErrors: validationErrorsRef.current,
    reset,
  };
}
