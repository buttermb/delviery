import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingFallback } from "./LoadingFallback";

export function SmartRootRedirect() {
  const [checking, setChecking] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // No session - send to marketing
          setRedirectPath("/marketing");
          return;
        }

        // User is authenticated - check their role/type
        const userId = session.user.id;
        
        // Check if super admin
        const { data: superAdminCheck } = await supabase
          .from('admin_users')
          .select('role, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (superAdminCheck) {
          setRedirectPath("/super-admin/dashboard");
          return;
        }

        // Check if tenant admin
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('account_id, accounts(tenant_id, tenants(slug))')
          .eq('user_id', userId)
          .single();

        if (profileCheck?.account_id) {
          const tenantSlug = (profileCheck.accounts as any)?.tenants?.slug;
          if (tenantSlug) {
            setRedirectPath(`/${tenantSlug}/admin/dashboard`);
            return;
          }
        }

        // Check if customer
        const { data: customerCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (customerCheck) {
          setRedirectPath("/customer/dashboard");
          return;
        }

        // Fallback to marketing if role unclear
        setRedirectPath("/marketing");
      } catch (error) {
        console.error("Error checking auth:", error);
        // On error, default to marketing
        setRedirectPath("/marketing");
      } finally {
        setChecking(false);
      }
    };

    checkAuthAndRedirect();
  }, []);

  if (checking) {
    return <LoadingFallback />;
  }

  return <Navigate to={redirectPath || "/marketing"} replace />;
}
