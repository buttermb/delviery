/**
 * Phone Verification Step Component
 * 
 * Handles phone number input and OTP verification during signup.
 */

import { useState, useEffect, useRef } from 'react';
import Phone from "lucide-react/dist/esm/icons/phone";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface PhoneVerificationStepProps {
  onVerified: (phoneHash: string, phoneNumber: string) => void;
  onSkip?: () => void;
  required?: boolean;
  className?: string;
}

interface VerificationState {
  step: 'input' | 'verify' | 'success';
  phoneNumber: string;
  countryCode: string;
  verificationId: string | null;
  error: string | null;
  isLoading: boolean;
  cooldownSeconds: number;
  attemptsRemaining: number;
}

// Common country codes
const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+64', country: 'NZ', flag: '🇳🇿' },
  { code: '+353', country: 'IE', flag: '🇮🇪' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+34', country: 'ES', flag: '🇪🇸' },
  { code: '+39', country: 'IT', flag: '🇮🇹' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
];

// ============================================================================
// Component
// ============================================================================

export function PhoneVerificationStep({
  onVerified,
  onSkip,
  required = false,
  className,
}: PhoneVerificationStepProps) {
  const [state, setState] = useState<VerificationState>({
    step: 'input',
    phoneNumber: '',
    countryCode: '+1',
    verificationId: null,
    error: null,
    isLoading: false,
    cooldownSeconds: 0,
    attemptsRemaining: 3,
  });

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (state.cooldownSeconds > 0) {
      cooldownRef.current = setTimeout(() => {
        setState(s => ({ ...s, cooldownSeconds: s.cooldownSeconds - 1 }));
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, [state.cooldownSeconds]);

  // Format phone number as user types
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Handle phone number input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setState(s => ({ ...s, phoneNumber: formatted, error: null }));
  };

  // Send verification SMS
  const sendVerificationSms = async () => {
    const digits = state.phoneNumber.replace(/\D/g, '');
    
    if (digits.length < 10) {
      setState(s => ({ ...s, error: 'Please enter a valid phone number' }));
      return;
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('send-verification-sms', {
        body: {
          phoneNumber: digits,
          countryCode: state.countryCode,
        },
      });

      if (error) throw error;

      if (data.error) {
        setState(s => ({ 
          ...s, 
          isLoading: false, 
          error: data.error,
        }));
        return;
      }

      setState(s => ({
        ...s,
        step: 'verify',
        verificationId: data.verificationId,
        isLoading: false,
        cooldownSeconds: 60, // 60 second cooldown before resend
        attemptsRemaining: 3,
      }));

      // Focus first OTP input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);

    } catch (error) {
      logger.error('Failed to send verification SMS', error as Error);
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Failed to send verification code. Please try again.',
      }));
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits entered
    if (digit && newDigits.every(d => d)) {
      verifyOtp(newDigits.join(''));
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const digits = pastedData.split('');
      setOtpDigits(digits);
      inputRefs.current[5]?.focus();
      verifyOtp(pastedData);
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP
  const verifyOtp = async (code: string) => {
    if (!state.verificationId) return;

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('verify-phone', {
        body: {
          verificationId: state.verificationId,
          code,
        },
      });

      if (error) throw error;

      if (data.error) {
        setState(s => ({
          ...s,
          isLoading: false,
          error: data.error,
          attemptsRemaining: data.remainingAttempts ?? s.attemptsRemaining - 1,
        }));
        setOtpDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success!
      setState(s => ({
        ...s,
        step: 'success',
        isLoading: false,
      }));

      // Notify parent
      const fullPhone = `${state.countryCode}${state.phoneNumber.replace(/\D/g, '')}`;
      onVerified(data.phoneHash, fullPhone);

    } catch (error) {
      logger.error('Failed to verify OTP', error as Error);
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Verification failed. Please try again.',
      }));
    }
  };

  // Resend code
  const resendCode = () => {
    setOtpDigits(['', '', '', '', '', '']);
    setState(s => ({ ...s, step: 'input', verificationId: null, error: null }));
  };

  // Render based on step
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className={cn(
          'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
          state.step === 'success' ? 'bg-green-100' : 'bg-primary/10'
        )}>
          {state.step === 'success' ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <Phone className="h-8 w-8 text-primary" />
          )}
        </div>
        <h3 className="text-xl font-semibold">
          {state.step === 'success' ? 'Phone Verified!' : 'Verify Your Phone'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {state.step === 'input' && 'We\'ll send you a verification code'}
          {state.step === 'verify' && `Enter the code sent to ${state.countryCode} ${state.phoneNumber}`}
          {state.step === 'success' && 'Your phone number has been verified'}
        </p>
      </div>

      {/* Error Alert */}
      {state.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Phone Input Step */}
      {state.step === 'input' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <div className="flex gap-2">
              <Select
                value={state.countryCode}
                onValueChange={(value) => setState(s => ({ ...s, countryCode: value }))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="tel"
                placeholder="(555) 555-5555"
                value={state.phoneNumber}
                onChange={handlePhoneChange}
                maxLength={14}
                className="flex-1"
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={sendVerificationSms}
            disabled={state.isLoading || state.phoneNumber.replace(/\D/g, '').length < 10}
          >
            {state.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Verification Code'
            )}
          </Button>

          {!required && onSkip && (
            <Button variant="ghost" className="w-full" onClick={onSkip}>
              Skip for now
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Standard SMS rates may apply. We'll never share your number.
          </p>
        </div>
      )}

      {/* OTP Verification Step */}
      {state.step === 'verify' && (
        <div className="space-y-4">
          {/* OTP Input */}
          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                className={cn(
                  'w-12 h-14 text-center text-2xl font-bold',
                  state.error && 'border-red-500'
                )}
                disabled={state.isLoading}
              />
            ))}
          </div>

          {/* Attempts remaining */}
          {state.attemptsRemaining < 3 && (
            <p className="text-sm text-center text-yellow-600">
              {state.attemptsRemaining} attempts remaining
            </p>
          )}

          {/* Resend */}
          <div className="text-center">
            {state.cooldownSeconds > 0 ? (
              <p className="text-sm text-muted-foreground">
                Resend code in {state.cooldownSeconds}s
              </p>
            ) : (
              <Button variant="link" onClick={resendCode} disabled={state.isLoading}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Resend Code
              </Button>
            )}
          </div>

          {/* Change number */}
          <Button
            variant="ghost"
            className="w-full"
            onClick={resendCode}
            disabled={state.isLoading}
          >
            Use a different number
          </Button>
        </div>
      )}

      {/* Success Step */}
      {state.step === 'success' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {state.countryCode} {state.phoneNumber}
          </p>
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Verified</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhoneVerificationStep;

