import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

interface AdminAuthContextType {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdminStatus = async (currentSession: Session | null) => {
      if (!isMounted) return;

      if (currentSession) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentSession.user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        if (isMounted) {
          setIsAdmin(!!data);
          setLoading(false);
        }
      } else {
        if (isMounted) {
          setIsAdmin(false);
          setLoading(false);
        }
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      checkAdminStatus(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setLoading(true);
      checkAdminStatus(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AdminAuthContext.Provider value={{ session, loading, isAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};
