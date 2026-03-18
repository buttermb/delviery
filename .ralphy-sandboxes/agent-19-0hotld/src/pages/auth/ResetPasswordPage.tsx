import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Key, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { usePasswordReset } from "@/hooks/usePasswordReset";
import { logger } from "@/lib/logger";
import { AuthErrorAlert, getAuthErrorMessage } from "@/components/auth/AuthErrorAlert";

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{20,}$/;

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "bg-muted" };

  const passed = PASSWORD_REQUIREMENTS.filter((req) => req.test(password)).length;
  const total = PASSWORD_REQUIREMENTS.length;
  const ratio = passed / total;

  if (ratio <= 0.2) return { score: ratio * 100, label: "Very weak", color: "bg-red-500" };
  if (ratio <= 0.4) return { score: ratio * 100, label: "Weak", color: "bg-orange-500" };
  if (ratio <= 0.6) return { score: ratio * 100, label: "Fair", color: "bg-yellow-500" };
  if (ratio <= 0.8) return { score: ratio * 100, label: "Good", color: "bg-blue-500" };
  return { score: 100, label: "Strong", color: "bg-green-500" };
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const {
    confirmReset,
    verifyToken,
    tokenVerification,
    isConfirmingReset,
  } = usePasswordReset();

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const requirementsMet = useMemo(
    () => PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) })),
    [password]
  );
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if (!token) {
      setTokenError("No reset token found. Please use the link from your email.");
      return;
    }

    if (!TOKEN_PATTERN.test(token)) {
      setTokenError("Invalid reset token format. Please use the link from your email.");
      logger.warn("Invalid token format on reset password page");
      return;
    }

    verifyToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verifyToken is defined below; only run when token changes
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!token) return;

    if (password !== confirmPassword) {
      setResetError("Passwords do not match. Please try again.");
      return;
    }

    const allMet = PASSWORD_REQUIREMENTS.every((req) => req.test(password));
    if (!allMet) {
      setResetError("Please meet all password requirements before continuing.");
      return;
    }

    try {
      const result = await confirmReset({ token, newPassword: password });
      if (result.success) {
        setSuccess(true);
        toast.success("Password Reset Successful", {
          description: result.message,
        });
      }
    } catch (error) {
      const message = getAuthErrorMessage(error, "Failed to reset password");
      if (message.toLowerCase().includes("expired")) {
        setTokenError(message);
      } else {
        setResetError(message);
      }
    }
  };

  // Loading state - verifying token
  if (tokenVerification.isVerifying) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Verifying your reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (tokenError || tokenVerification.error) {
    const errorMessage = tokenError || tokenVerification.error;
    const isExpired = errorMessage?.toLowerCase().includes("expired");

    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <XCircle className="h-5 w-5 text-destructive" />
              {isExpired ? "Link Expired" : "Invalid Reset Link"}
            </CardTitle>
            <CardDescription>
              {isExpired
                ? "This password reset link has expired. For security, reset links are only valid for a limited time."
                : "This password reset link is invalid or has already been used."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/auth/forgot-password">
                Request a New Reset Link
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/login">
                Back to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Password Reset Successful</h2>
            <p className="text-muted-foreground">
              Your password has been updated. You can now log in with your new password.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">
                Go to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password reset form
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Key className="h-5 w-5 text-primary" />
            Set New Password
          </CardTitle>
          <CardDescription>
            {tokenVerification.email
              ? `Enter a new password for ${tokenVerification.email}`
              : "Enter your new password below"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            <AuthErrorAlert
              message={resetError ?? ''}
              type="error"
              variant="light"
              className="mb-2"
            />

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isConfirmingReset}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength Meter */}
              {password.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Password strength</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score >= 80 ? "text-green-600" :
                      passwordStrength.score >= 60 ? "text-blue-600" :
                      passwordStrength.score >= 40 ? "text-yellow-600" :
                      "text-red-600"
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <Progress
                    value={passwordStrength.score}
                    className="h-2"
                  />

                  {/* Requirements Checklist */}
                  <ul className="space-y-1 mt-2">
                    {requirementsMet.map((req) => (
                      <li
                        key={req.label}
                        className={`flex items-center gap-2 text-xs ${
                          req.met ? "text-green-600" : "text-muted-foreground"
                        }`}
                      >
                        {req.met ? (
                          <Check className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <X className="h-3 w-3 flex-shrink-0" />
                        )}
                        {req.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isConfirmingReset}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordsMatch && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Passwords match
                </p>
              )}
              {passwordsMismatch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" />
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isConfirmingReset || !passwordsMatch || passwordStrength.score < 100}
              aria-busy={isConfirmingReset}
            >
              {isConfirmingReset ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
