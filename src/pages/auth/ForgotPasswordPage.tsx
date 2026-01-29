/**
 * Forgot Password Page
 * Email input form that requests a password reset link.
 * Shows success message regardless of email existence for security.
 * Implements client-side rate limiting to prevent abuse.
 */

import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { usePasswordReset } from "@/hooks/usePasswordReset";
import { logger } from "@/lib/logger";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;
const COOLDOWN_MS = 30_000; // 30 second cooldown after hitting limit

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const requestTimestamps = useRef<number[]>([]);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { requestReset, isRequestingReset } = usePasswordReset();

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

  const isRateLimited = useCallback((): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (requestTimestamps.current.length >= MAX_REQUESTS_PER_WINDOW) {
      logger.debug("Password reset rate limit reached");
      startCooldown();
      return true;
    }

    return false;
  }, [startCooldown]);

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!isValidEmail(value.trim())) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    if (isRateLimited()) {
      return;
    }

    // Track this request for rate limiting
    requestTimestamps.current.push(Date.now());

    // Always show success for security (don't reveal if email exists)
    // Fire and forget the actual request
    requestReset({ email: email.trim() })
      .then(() => {
        logger.debug("Password reset request settled");
      })
      .catch(() => {
        // Silently fail - don't reveal if email exists
        logger.debug("Password reset request failed silently");
      });

    // Immediately show success regardless of API result
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription className="mt-2">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              you will receive a password reset link shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t see the email? Check your spam folder or try again with a different address.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                disabled={rateLimited}
              >
                {rateLimited
                  ? `Try again in ${cooldownRemaining}s`
                  : "Try a different email"}
              </Button>
              <Link to="/login" className="w-full">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Back to login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription className="mt-2">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email address</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) {
                    validateEmail(e.target.value);
                  }
                }}
                onBlur={() => {
                  if (email) validateEmail(email);
                }}
                disabled={isRequestingReset || rateLimited}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
                inputMode="email"
                enterKeyHint="send"
                autoComplete="email"
                autoFocus
                className="min-h-[44px]"
              />
              {emailError && (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {rateLimited && (
              <p className="text-sm text-destructive text-center" role="alert">
                Too many requests. Please try again in {cooldownRemaining} seconds.
              </p>
            )}

            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={isRequestingReset || rateLimited}
              aria-busy={isRequestingReset}
            >
              {isRequestingReset ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Send reset link
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="mr-1 h-3 w-3" aria-hidden="true" />
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
