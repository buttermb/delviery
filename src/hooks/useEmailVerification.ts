import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  isDisposable: boolean;
  isFreeProvider: boolean;
  hasMxRecords: boolean;
  domain: string;
  mxRecords: string[];
  syntaxValid: boolean;
  score: number;
  reason?: string;
}

interface UseEmailVerificationOptions {
  checkMx?: boolean;
  checkDisposable?: boolean;
}

export function useEmailVerification(options: UseEmailVerificationOptions = {}) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<EmailVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyEmail = useCallback(async (email: string): Promise<EmailVerificationResult | null> => {
    if (!email || !email.includes('@')) {
      setError('Invalid email format');
      return null;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-email', {
        body: {
          email,
          checkMx: options.checkMx ?? true,
          checkDisposable: options.checkDisposable ?? true,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      logger.error('Email verification error', err);
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [options.checkMx, options.checkDisposable]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    verifyEmail,
    isVerifying,
    result,
    error,
    reset,
  };
}

// Quick validation without full verification (for real-time typing)
export function useQuickEmailValidation() {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const validate = useCallback((email: string) => {
    if (!email) {
      setIsValid(null);
      setMessage(null);
      return;
    }

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setIsValid(false);
      setMessage('Invalid email format');
      return;
    }

    // Check for common disposable domains (quick check)
    const domain = email.split('@')[1]?.toLowerCase();
    const quickDisposableCheck = [
      'tempmail.com', 'throwaway.email', 'guerrillamail.com', 
      'mailinator.com', 'yopmail.com', '10minutemail.com'
    ];
    
    if (quickDisposableCheck.includes(domain)) {
      setIsValid(false);
      setMessage('Disposable emails not allowed');
      return;
    }

    setIsValid(true);
    setMessage(null);
  }, []);

  const reset = useCallback(() => {
    setIsValid(null);
    setMessage(null);
  }, []);

  return { validate, isValid, message, reset };
}
