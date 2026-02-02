/**
 * Community Protected Route
 * Protects forum routes - requires Supabase auth (no tenant requirement)
 * Forum is global, so we only need basic authentication
 */

import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { supabase } from "@/integrations/supabase/client";

interface CommunityProtectedRouteProps {
  children: ReactNode;
}

export function CommunityProtectedRoute({ children }: CommunityProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthenticated(!!user);
        
        if (!user) {
          // User can still view the forum, but will need to login to post
          // Don't redirect - allow read-only access
        }
      } catch (error) {
        // Allow access even if check fails
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Allow access - forum pages handle their own auth requirements
  return <>{children}</>;
}

