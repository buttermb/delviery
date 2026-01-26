

# Fix Plan: Corrupted Files from Incorrect Merge

## Summary
Two files have build errors. After investigation, `StorefrontBuilder.tsx` appears structurally intact, but `useEmailVerification.ts` is severely corrupted and requires a complete rewrite.

---

## Files Affected

| File | Status | Action |
|------|--------|--------|
| `src/hooks/useEmailVerification.ts` | Corrupted | Complete rewrite |
| `src/pages/admin/storefront/StorefrontBuilder.tsx` | Likely OK | Verify after first fix |

---

## Fix 1: Rewrite useEmailVerification.ts

The current file has fragments from multiple implementations mixed together incorrectly:

**Current Issues:**
- Lines 35-45: Incomplete mutation function with orphaned `catch`/`finally` blocks
- References to undefined variables: `setResult`, `setError`, `setIsVerifying`, `options.checkMx`, `options.checkDisposable`
- Orphaned `if (error)` block outside any function (lines 47-51)
- Missing `toast` import

**Fixed Implementation:**
```typescript
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface VerifyEmailResponse {
  success: boolean;
  alreadyVerified?: boolean;
  expired?: boolean;
  message?: string;
}

interface ResendVerificationResponse {
  success: boolean;
  message?: string;
}

export interface EmailVerificationState {
  isAlreadyVerified: boolean;
  isExpired: boolean;
  canResend: boolean;
}

export function useEmailVerification() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const verifyEmail = useMutation({
    mutationFn: async (verificationToken?: string): Promise<VerifyEmailResponse> => {
      const tokenToUse = verificationToken || token;
      if (!tokenToUse) {
        throw new Error('No verification token provided');
      }

      const { data, error } = await supabase.functions.invoke('auth-verify-email', {
        body: { token: tokenToUse },
      });

      if (error) {
        throw new Error(error.message || 'Email verification failed');
      }

      return data as VerifyEmailResponse;
    },
    onError: (error: Error) => {
      logger.error('Email verification failed', error, { component: 'useEmailVerification' });
      toast.error('Email verification failed', { description: error.message });
    },
  });

  const resendVerification = useMutation({
    mutationFn: async (email: string): Promise<ResendVerificationResponse> => {
      if (!email) {
        throw new Error('Email is required to resend verification');
      }

      const { data, error } = await supabase.functions.invoke('auth-signup', {
        body: { email, resend: true },
      });

      if (error) {
        throw new Error(error.message || 'Failed to resend verification email');
      }

      return data as ResendVerificationResponse;
    },
    onError: (error: Error) => {
      logger.error('Resend verification failed', error, { component: 'useEmailVerification' });
      toast.error('Failed to resend verification email', { description: error.message });
    },
  });

  const verificationState: EmailVerificationState = {
    isAlreadyVerified: verifyEmail.data?.alreadyVerified === true,
    isExpired: verifyEmail.data?.expired === true,
    canResend: verifyEmail.data?.expired === true,
  };

  return {
    token,
    verifyEmail,
    resendVerification,
    verificationState,
    isVerifying: verifyEmail.isPending,
    isResending: resendVerification.isPending,
    verifyError: verifyEmail.error,
    resendError: resendVerification.error,
    isSuccess: verifyEmail.isSuccess && !verifyEmail.data?.alreadyVerified && !verifyEmail.data?.expired,
  };
}
```

**Key Fixes:**
1. Added missing `toast` import from 'sonner'
2. Completed the `verifyEmail` mutation with proper API call
3. Removed orphaned code fragments
4. Maintained existing interface contracts

---

## Fix 2: Verify StorefrontBuilder.tsx

After fixing the first file, rebuild to confirm StorefrontBuilder errors are resolved. The file structure appears correct upon review.

---

## Execution Order

1. Rewrite `useEmailVerification.ts` completely
2. Rebuild project to verify all errors resolved
3. If StorefrontBuilder errors persist, investigate further

---

## Technical Notes

- The corruption pattern suggests a failed git merge or partial file save
- The `useEmailVerification.ts` file has code from what appears to be a different email validation hook mixed in
- StorefrontBuilder.tsx spans 1294 lines and closes properly at line 1200 with helper functions following

