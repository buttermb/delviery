import { logger } from '@/lib/logger';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function VendorLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { login, vendor, isAuthenticated } = useVendorAuth();

  // Redirect if already logged in
  if (isAuthenticated && vendor) {
    navigate("/vendor/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      logger.info('Vendor login attempt', { component: 'VendorLoginPage' });

      await login(formData.email, formData.password);

      toast.success("Login successful");
      // Navigation happens automatically via useEffect or the ProtectedRoute logic, 
      // but explicit navigate is safer for UX response
      navigate("/vendor/dashboard");
    } catch (error) {
      logger.error('Vendor login failed', error instanceof Error ? error : new Error(String(error)), { component: 'VendorLoginPage' });
      toast.error(error instanceof Error ? error.message : "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Vendor Portal Login</CardTitle>
          <CardDescription>
            Access your supplier portal to view purchase orders and manage invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="vendor@example.com"
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                className="min-h-[44px] touch-manipulation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                autoComplete="current-password"
                enterKeyHint="done"
                className="min-h-[44px] touch-manipulation"
              />
            </div>
            <Button
              type="submit"
              className="w-full min-h-[44px] touch-manipulation"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

