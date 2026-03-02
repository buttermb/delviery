/**
 * Forgot Password Page
 * Email input form that requests a password reset link.
 * Shows success message regardless of email existence for security.
 * Implements client-side rate limiting to prevent abuse.
 *
 * Features:
 * - Email validation with clear error messages
 * - Client-side rate limiting (3 requests per minute, 30s cooldown)
 * - Visual rate limit countdown display
 * - Success state with helpful instructions
 * - Tenant-aware routing for multi-tenant support
 * - Accessible form with proper ARIA attributes
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft, CheckCircle2, Clock, Send } from "lucide-react";
import { usePasswordReset } from "@/hooks/usePasswordReset";
import { RateLimitWarning } from "@/components/auth/RateLimitWarning";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { logger } from "@/lib/logger";

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;
const COOLDOWN_MS = 30_000; // 30 second cooldown after hitting limit

// Email validation regex - standard RFC 5322 simplified pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function ForgotPasswordPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [requestCount, setRequestCount] = useState(0);

  const requestTimestamps = useRef<number[]>([]);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { requestReset, isRequestingReset } = usePasswordReset();

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
      }
    };
  }, []);

  // Build the back to login URL based on tenant context
  const getLoginUrl = useCallback(() => {
    return "/saas/login";
  }, []);

  const startCooldown = useCallback(() => {
    setRateLimited(true);
    setCooldownRemaining(Math.ceil(COOLDOWN_MS / 1000));

    if (cooldownTimer.current) {
      clearInterval(cooldownTimer.current);
    }

    cooldownTimer.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          setRateLimited(false);
          if (cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    // Update request count for UI display
    setRequestCount(requestTimestamps.current.length);

    if (requestTimestamps.current.length >= MAX_REQUESTS_PER_WINDOW) {
      logger.debug("Password reset rate limit reached", {
        requests: requestTimestamps.current.length,
        maxRequests: MAX_REQUESTS_PER_WINDOW
      });
      startCooldown();
      return true;
    }

    return false;
  }, [startCooldown]);

  const validateEmail = useCallback((value: string): boolean => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      setEmailError("Email is required");
      return false;
    }

    if (trimmedValue.length > 255) {
      setEmailError("Email must be less than 255 characters");
      return false;
    }

    if (!isValidEmail(trimmedValue)) {
      setEmailError("Please enter a valid email address");
      return false;
    }

    setEmailError("");
    return true;
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setEmail(newValue);

    // Clear error on type if there was one, but don't validate until blur
    if (emailError && newValue.trim()) {
      setEmailError("");
    }
  }, [emailError]);

  const handleEmailBlur = useCallback(() => {
    if (email.trim()) {
      validateEmail(email);
    }
  }, [email, validateEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    if (checkRateLimit()) {
      return;
    }

    // Track this request for rate limiting
    requestTimestamps.current.push(Date.now());
    setRequestCount(requestTimestamps.current.length);

    // Always show success for security (don't reveal if email exists)
    // Fire and forget the actual request
    const trimmedEmail = email.trim().toLowerCase();

    requestReset({
      email: trimmedEmail,
      tenantSlug,
      userType: "tenant_admin"
    })
      .then(() => {
        logger.debug("Password reset request completed", { email: trimmedEmail });
      })
      .catch(() => {
        // Silently fail - don't reveal if email exists
        logger.debug("Password reset request failed silently", { email: trimmedEmail });
      });

    // Immediately show success regardless of API result
    setSubmitted(true);
  };

  // Calculate remaining requests for display
  const remainingRequests = MAX_REQUESTS_PER_WINDOW - requestCount;

  // Success state content
  if (submitted) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          {/* Success icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
          </div>

          {/* Success heading */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{email}</span>,
              you will receive a password reset link shortly.
            </p>
          </div>

          {/* Helpful tips */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
            <p className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>The link expires in 1 hour for security.</span>
            </p>
            <p>
              Don&apos;t see the email? Check your spam folder or try again with a different address.
            </p>
          </div>

          {/* Rate limit warning in success state */}
          {rateLimited && (
            <RateLimitWarning remainingSeconds={cooldownRemaining} />
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="outline"
              className="w-full min-h-[44px]"
              disabled={isRequestingReset || rateLimited}
              aria-busy={isRequestingReset}
            >
              {rateLimited ? (
                <>
                  <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Try again in {cooldownRemaining}s
                </>
              ) : (
                "Try a different email"
              )}
            </Button>

            <Link to={getLoginUrl()} className="w-full">
              <Button variant="ghost" className="w-full min-h-[44px]">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back to login
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Form state content
  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email address</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              disabled={isRequestingReset || rateLimited}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : "email-hint"}
              aria-required="true"
              inputMode="email"
              enterKeyHint="send"
              autoComplete="email"
              autoFocus
              className="min-h-[44px]"
            />
            {emailError ? (
              <p id="email-error" className="text-sm text-destructive" role="alert" aria-live="assertive">
                {emailError}
              </p>
            ) : (
              <p id="email-hint" className="text-xs text-muted-foreground">
                We&apos;ll send a secure reset link to this address.
              </p>
            )}
          </div>

          {/* Rate limit warning */}
          {rateLimited && (
            <RateLimitWarning remainingSeconds={cooldownRemaining} />
          )}

          {/* Request count indicator - only show when approaching limit */}
          {!rateLimited && requestCount > 0 && remainingRequests <= 2 && (
            <p className="text-xs text-muted-foreground text-center">
              {remainingRequests} request{remainingRequests !== 1 ? "s" : ""} remaining
            </p>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full min-h-[44px]"
            disabled={isRequestingReset || rateLimited || !email.trim()}
            aria-busy={isRequestingReset}
          >
            {isRequestingReset ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                Send reset link
              </>
            )}
          </Button>

          {/* Back to login link */}
          <div className="text-center pt-2">
            <Link
              to={getLoginUrl()}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-3 w-3" aria-hidden="true" />
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
