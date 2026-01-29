/**
 * Super Admin / SAAS Platform Login
 * Separate login for managing all tenant accounts
 */

import { logger } from '@/lib/logger';
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, Building2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { handleError } from '@/utils/errorHandling/handlers';

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.session) throw new Error("No session returned");

      // Check if user is a platform super admin
      // Method 1: Check user metadata for platform_admin flag
      const isPlatformAdmin = authData.user.user_metadata?.role === 'platform_admin' ||
        authData.user.user_metadata?.platform_admin === true ||
        authData.user.user_metadata?.is_super_admin === true;

      // Method 2: Check tenant_users for super_admin role (tenant admins can also access platform admin)
      const { data: tenantUser } = await (supabase as any)
        .from("tenant_users")
        .select("role, tenant_id")
        .eq("email", email)
        .eq("role", "super_admin")
        .maybeSingle();

      // Method 3: Check if email is in platform admins list (you can maintain this in a config)
      const platformAdminEmails = [
        'admin@platform.com',
        'superadmin@platform.com',
        'sake121211@gmail.com',
        'sake2605@icloud.com',
      ];

      const isEmailPlatformAdmin = platformAdminEmails.includes(email.toLowerCase());

      if (!isPlatformAdmin && !tenantUser && !isEmailPlatformAdmin) {
        await supabase.auth.signOut();
        throw new Error("You don't have platform super admin access. Please contact support.");
      }

      toast({
        title: "Welcome, Super Admin!",
        description: "Logged in successfully",
      });

      // Redirect to super admin dashboard
      navigate("/saas/admin", { replace: true });
      navigate("/saas/admin", { replace: true });
    } catch (error) {
      handleError(error, { component: 'SuperAdminLogin', toastTitle: 'Login failed' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      {/* Back to Home Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Platform Admin Portal</CardTitle>
          <CardDescription>
            Manage all tenant accounts and platform settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="superadmin@platform.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Sign In as Super Admin
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <div className="text-center text-sm text-muted-foreground">
              <p>For tenant admin access, use your tenant-specific login URL</p>
            </div>
          </div>

          <div className="mt-4 text-xs text-center text-muted-foreground">
            <p>Platform administrators can manage all tenants, billing, and platform settings.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminLogin;

