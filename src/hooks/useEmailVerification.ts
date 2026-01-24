import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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
