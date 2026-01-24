/**
 * Reusable Sign Up Form Component
 * Provides email, password (with strength meter + show/hide), confirm password,
 * full name, phone (with formatting), terms checkbox, and error display.
 */

import { useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form-field';
import { ErrorSummary } from '@/components/ui/form-field';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { cn } from '@/lib/utils';

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  termsAccepted: boolean;
}

export interface SignupFormProps {
  /** Called when form is submitted with valid data */
  onSubmit: (data: SignupFormData) => void | Promise<void>;
  /** Whether the form is in a loading/submitting state */
  loading?: boolean;
  /** External error message to display (e.g. from API) */
  error?: string;
  /** Additional CSS classes for the form container */
  className?: string;
  /** Label for the submit button (defaults to "Create Account") */
  submitLabel?: string;
  /** Terms of service link URL */
  termsUrl?: string;
  /** Privacy policy link URL */
  privacyUrl?: string;
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  if (email.length > 255) return 'Email is too long';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/\d/.test(password)) return 'Password must contain at least one number';
  return undefined;
}

function validateConfirmPassword(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return undefined;
}

function validateFullName(name: string): string | undefined {
  if (!name.trim()) return 'Full name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  if (name.trim().length > 100) return 'Name is too long';
  return undefined;
}

function validatePhone(phone: string): string | undefined {
  if (!phone) return 'Phone number is required';
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) return 'Phone number must be 10 digits';
  return undefined;
}

export function SignupForm({
  onSubmit,
  loading = false,
  error,
  className,
  submitLabel = 'Create Account',
  termsUrl = '/terms',
  privacyUrl = '/privacy',
}: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateField = useCallback((field: string, value?: string): string | undefined => {
    switch (field) {
      case 'email':
        return validateEmail(value ?? email);
      case 'password':
        return validatePassword(value ?? password);
      case 'confirmPassword':
        return validateConfirmPassword(value ?? password, value !== undefined ? value : confirmPassword);
      case 'fullName':
        return validateFullName(value ?? fullName);
      case 'phone':
        return validatePhone(value ?? phone);
      case 'termsAccepted':
        return !termsAccepted ? 'You must accept the terms and conditions' : undefined;
      default:
        return undefined;
    }
  }, [email, password, confirmPassword, fullName, phone, termsAccepted]);

  const handleBlur = useCallback((field: string) => {
    markTouched(field);
    const fieldError = validateField(field);
    setErrors(prev => {
      if (fieldError) {
        return { ...prev, [field]: fieldError };
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, [markTouched, validateField]);

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    const confirmError = validateConfirmPassword(password, confirmPassword);
    if (confirmError) newErrors.confirmPassword = confirmError;

    const nameError = validateFullName(fullName);
    if (nameError) newErrors.fullName = nameError;

    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;

    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
      fullName: true,
      phone: true,
      termsAccepted: true,
    });

    return Object.keys(newErrors).length === 0;
  }, [email, password, confirmPassword, fullName, phone, termsAccepted]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    await onSubmit({
      email: email.trim(),
      password,
      confirmPassword,
      fullName: fullName.trim(),
      phone: phone.replace(/\D/g, ''),
      termsAccepted,
    });
  }, [validateAll, onSubmit, email, password, confirmPassword, fullName, phone, termsAccepted]);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    // Re-validate confirm password if it has been touched
    if (touched.confirmPassword && confirmPassword) {
      const confirmError = validateConfirmPassword(value, confirmPassword);
      setErrors(prev => {
        if (confirmError) return { ...prev, confirmPassword: confirmError };
        const next = { ...prev };
        delete next.confirmPassword;
        return next;
      });
    }
  }, [touched.confirmPassword, confirmPassword]);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', className)}
      noValidate
    >
      {/* External error display */}
      {error && (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Error summary (shown after submit attempt with multiple errors) */}
      {Object.keys(errors).length > 2 && touched.email && (
        <ErrorSummary errors={errors} />
      )}

      {/* Full Name */}
      <FormField
        label="Full Name"
        htmlFor="signup-fullName"
        required
        error={touched.fullName ? errors.fullName : undefined}
      >
        <Input
          id="signup-fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => handleBlur('fullName')}
          placeholder="Enter your full name"
          autoComplete="name"
          error={!!(touched.fullName && errors.fullName)}
          disabled={loading}
          aria-invalid={!!(touched.fullName && errors.fullName)}
        />
      </FormField>

      {/* Email */}
      <FormField
        label="Email"
        htmlFor="signup-email"
        required
        error={touched.email ? errors.email : undefined}
      >
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="you@example.com"
          autoComplete="email"
          error={!!(touched.email && errors.email)}
          disabled={loading}
          aria-invalid={!!(touched.email && errors.email)}
        />
      </FormField>

      {/* Phone */}
      <FormField
        label="Phone"
        htmlFor="signup-phone"
        required
        error={touched.phone ? errors.phone : undefined}
      >
        <Input
          id="signup-phone"
          type="tel"
          value={phone}
          onChange={handlePhoneChange}
          onBlur={() => handleBlur('phone')}
          placeholder="(555) 123-4567"
          autoComplete="tel"
          error={!!(touched.phone && errors.phone)}
          disabled={loading}
          aria-invalid={!!(touched.phone && errors.phone)}
        />
      </FormField>

      {/* Password */}
      <FormField
        label="Password"
        htmlFor="signup-password"
        required
        error={touched.password ? errors.password : undefined}
      >
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            onBlur={() => handleBlur('password')}
            placeholder="Create a strong password"
            autoComplete="new-password"
            error={!!(touched.password && errors.password)}
            disabled={loading}
            className="pr-10"
            aria-invalid={!!(touched.password && errors.password)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <PasswordStrengthIndicator password={password} className="mt-2" />
      </FormField>

      {/* Confirm Password */}
      <FormField
        label="Confirm Password"
        htmlFor="signup-confirmPassword"
        required
        error={touched.confirmPassword ? errors.confirmPassword : undefined}
      >
        <div className="relative">
          <Input
            id="signup-confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => handleBlur('confirmPassword')}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            error={!!(touched.confirmPassword && errors.confirmPassword)}
            disabled={loading}
            className="pr-10"
            aria-invalid={!!(touched.confirmPassword && errors.confirmPassword)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </FormField>

      {/* Terms Checkbox */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="signup-terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            disabled={loading}
            aria-invalid={!!(touched.termsAccepted && errors.termsAccepted)}
            className="mt-0.5"
          />
          <Label
            htmlFor="signup-terms"
            className="text-sm font-normal leading-snug cursor-pointer"
          >
            I agree to the{' '}
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
              tabIndex={0}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
              tabIndex={0}
            >
              Privacy Policy
            </a>
          </Label>
        </div>
        {touched.termsAccepted && errors.termsAccepted && (
          <p className="text-sm text-destructive" role="alert">
            {errors.termsAccepted}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="hero"
        className="w-full"
        disabled={loading}
        loading={loading}
      >
        {loading ? 'Creating Account...' : submitLabel}
      </Button>
    </form>
  );
}
