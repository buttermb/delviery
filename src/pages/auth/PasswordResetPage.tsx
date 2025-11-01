import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { verifyResetToken, resetPasswordWithToken } from "@/utils/passwordReset";

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

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setValid(false);
        setVerifying(false);
        return;
      }

      // Try to detect user type from URL or token structure
      // In production, this would be encoded in the token
      const path = window.location.pathname;
      if (path.includes("/super-admin/reset")) {
        setUserType("super_admin");
      } else if (path.includes("/shop/reset")) {
        setUserType("customer");
      } else {
        setUserType("tenant_admin");
      }

      try {
        const result = await verifyResetToken(token, userType);
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
      } catch (error: any) {
        setValid(false);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to verify reset token",
        });
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, userType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
            // Try to extract tenant slug from URL
            const pathMatch = window.location.pathname.match(/^\/([^/]+)\/admin\/reset/);
            const tenantSlug = pathMatch ? pathMatch[1] : null;
            navigate(tenantSlug ? `/${tenantSlug}/admin/login` : "/admin/login");
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
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reset password",
      });
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying reset token...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Invalid Reset Link
            </CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (userType === "super_admin") {
                  navigate("/super-admin/login");
                } else if (userType === "tenant_admin") {
                  const pathMatch = window.location.pathname.match(/^\/([^/]+)\/admin\/reset/);
                  const tenantSlug = pathMatch ? pathMatch[1] : null;
                  navigate(tenantSlug ? `/${tenantSlug}/admin/login` : "/admin/login");
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Password Reset Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Your password has been updated. Redirecting to login...
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Enter your new password for {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

