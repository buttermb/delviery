import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Key } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { verifyResetToken, resetPasswordWithToken } from "@/utils/passwordReset";
import { handleError } from "@/utils/errorHandling/handlers";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "", color: "" };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(password)) score++;

  // Cap score at 4
  const finalScore = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;

  const strengthMap: Record<0 | 1 | 2 | 3 | 4, { label: string; color: string }> = {
    0: { label: "", color: "" },
    1: { label: "Weak", color: "bg-red-500" },
    2: { label: "Fair", color: "bg-orange-500" },
    3: { label: "Good", color: "bg-yellow-500" },
    4: { label: "Strong", color: "bg-green-500" },
  };

  return { score: finalScore, ...strengthMap[finalScore] };
}

export default function PasswordResetPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"super_admin" | "tenant_admin" | "customer">("tenant_admin");
  const [success, setSuccess] = useState(false);
  const { validateToken } = useCsrfToken();

  // Password breach checking
  const { checking: breachChecking, result: breachResult, suggestPassword } = usePasswordBreachCheck(password);

  // Password strength calculation
  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setValid(false);
        setVerifying(false);
        return;
      }

      // Try to detect user type from URL or token structure
      const path = window.location.pathname;
      let detectedType: "super_admin" | "tenant_admin" | "customer" = "tenant_admin";

      if (path.includes("/super-admin/reset")) {
        detectedType = "super_admin";
      } else if (path.includes("/shop/reset")) {
        detectedType = "customer";
      } else {
        detectedType = "tenant_admin";
      }

      setUserType(detectedType);

      try {
        const result = await verifyResetToken(token, detectedType);
        if (result.valid && result.email) {
          setValid(true);
          setEmail(result.email);
        } else {
          setValid(false);
          toast({
            variant: "destructive",
            title: "Invalid Token",
            description: result.error || "This reset link is invalid or has expired",
          });
        }
      } catch (error) {
        setValid(false);
        handleError(error, {
          component: "PasswordResetPage.verifyToken",
          toastTitle: "Error",
          showToast: true
        });
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateToken()) {
      toast({
        variant: "destructive",
        title: "Security Error",
        description: "Invalid security token. Please refresh the page and try again.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password Mismatch",
        description: "Passwords do not match",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
      });
      return;
    }

    if (breachResult?.blocked) {
      toast({
        variant: "destructive",
        title: "Password not allowed",
        description: "This password has been found in too many data breaches. Please choose a different password.",
      });
      return;
    }

    if (!token) return;

    setLoading(true);
    try {
      const result = await resetPasswordWithToken(token, password, userType);

      if (result.success) {
        setSuccess(true);
        toast({
          title: "Password Reset",
          description: result.message,
        });

        // Redirect to login after 2 seconds
        setTimeout(() => {
          if (userType === "super_admin") {
            navigate("/super-admin/login");
          } else if (userType === "tenant_admin") {
            const pathMatch = window.location.pathname.match(/^\/([^/]+)\/admin\/reset/);
            const tenantSlug = pathMatch ? pathMatch[1] : null;
            navigate(tenantSlug ? `/${tenantSlug}/admin/login` : "/marketing");
          } else {
            const pathMatch = window.location.pathname.match(/^\/([^/]+)\/shop\/reset/);
            const tenantSlug = pathMatch ? pathMatch[1] : null;
            navigate(tenantSlug ? `/${tenantSlug}/shop/login` : "/shop/login");
          }
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      }
    } catch (error) {
      handleError(error, {
        component: "PasswordResetPage.handleSubmit",
        toastTitle: "Error",
        showToast: true
      });
    } finally {
      setLoading(false);
    }
  };

  // Get theme classes based on user type
  const getThemeClasses = () => {
    if (userType === "super_admin") {
      return {
        bg: "bg-[hsl(var(--super-admin-bg))]",
        card: "bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-sm border-[hsl(var(--super-admin-border))]",
        text: "text-[hsl(var(--super-admin-text))]",
        textLight: "text-[hsl(var(--super-admin-text-light))]",
        border: "border-[hsl(var(--super-admin-border))]",
        input: "bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus:border-[hsl(var(--super-admin-primary))]",
        button: "bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white",
        buttonOutline: "border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] hover:bg-[hsl(var(--super-admin-surface))]",
      };
    } else if (userType === "tenant_admin") {
      return {
        bg: "bg-[hsl(var(--tenant-bg))]",
        card: "bg-white border-[hsl(var(--tenant-border))]",
        text: "text-[hsl(var(--tenant-text))]",
        textLight: "text-[hsl(var(--tenant-text-light))]",
        border: "border-[hsl(var(--tenant-border))]",
        input: "border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20",
        button: "bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white",
        buttonOutline: "border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]",
      };
    } else {
      return {
        bg: "bg-[hsl(var(--customer-bg))]",
        card: "bg-white border-[hsl(var(--customer-border))]",
        text: "text-[hsl(var(--customer-text))]",
        textLight: "text-[hsl(var(--customer-text-light))]",
        border: "border-[hsl(var(--customer-border))]",
        input: "border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20",
        button: "bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white",
        buttonOutline: "border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]",
      };
    }
  };

  const theme = getThemeClasses();

  if (verifying) {
    return (
      <div className={`min-h-dvh flex items-center justify-center ${theme.bg} p-4`}>
        <Card className={`max-w-md w-full ${theme.card} shadow-xl`}>
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[hsl(var(--super-admin-primary))]" />
            <p className={theme.textLight}>Verifying reset token...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className={`min-h-dvh flex items-center justify-center ${theme.bg} p-4`}>
        <Card className={`max-w-md w-full ${theme.card} shadow-xl`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${theme.text}`}>
              <XCircle className="h-5 w-5 text-red-600" />
              Invalid Reset Link
            </CardTitle>
            <CardDescription className={theme.textLight}>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className={`w-full ${theme.buttonOutline}`}
              onClick={() => {
                if (userType === "super_admin") {
                  navigate("/super-admin/login");
                } else if (userType === "tenant_admin") {
                  const pathMatch = window.location.pathname.match(/^\/([^/]+)\/admin\/reset/);
                  const tenantSlug = pathMatch ? pathMatch[1] : null;
                  navigate(tenantSlug ? `/${tenantSlug}/admin/login` : "/marketing");
                } else {
                  const pathMatch = window.location.pathname.match(/^\/([^/]+)\/shop\/reset/);
                  const tenantSlug = pathMatch ? pathMatch[1] : null;
                  navigate(tenantSlug ? `/${tenantSlug}/shop/login` : "/shop/login");
                }
              }}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className={`min-h-dvh flex items-center justify-center ${theme.bg} p-4`}>
        <Card className={`max-w-md w-full ${theme.card} shadow-xl`}>
          <CardContent className="pt-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${theme.text}`}>Password Reset Successful!</h2>
            <p className={`${theme.textLight} mb-4`}>
              Your password has been updated. Redirecting to login...
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-dvh flex items-center justify-center ${theme.bg} p-4`}>
      <Card className={`max-w-md w-full ${theme.card} shadow-xl`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${theme.text}`}>
            <Key className="h-5 w-5 text-[hsl(var(--super-admin-primary))]" />
            Reset Password
          </CardTitle>
          <CardDescription className={theme.textLight}>
            Enter your new password for {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className={theme.text}>New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
                autoComplete="new-password"
                className={theme.input}
              />
              <p className={`text-xs ${theme.textLight}`}>
                Must be at least 8 characters
              </p>
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                          level <= passwordStrength.score
                            ? passwordStrength.color
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength.label && (
                    <p className={`text-xs font-medium ${
                      passwordStrength.score === 1 ? "text-red-600" :
                      passwordStrength.score === 2 ? "text-orange-600" :
                      passwordStrength.score === 3 ? "text-yellow-600" :
                      "text-green-600"
                    }`}>
                      Password strength: {passwordStrength.label}
                    </p>
                  )}
                </div>
              )}
              {password.length >= 8 && (
                <PasswordBreachWarning
                  checking={breachChecking}
                  result={breachResult}
                  suggestPassword={suggestPassword}
                  onGeneratePassword={(pw) => {
                    setPassword(pw);
                    setConfirmPassword(pw);
                  }}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className={theme.text}>Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
                autoComplete="new-password"
                className={theme.input}
              />
            </div>
            <Button type="submit" className={`w-full ${theme.button}`} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
