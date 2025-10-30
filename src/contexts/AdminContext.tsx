import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "super_admin" | "admin" | "compliance_officer" | "support";
}

interface AdminContextType {
  admin: AdminUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const verifyAdmin = async (currentSession: Session) => {
    try {
      // Check if user has admin role directly from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentSession.user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!roleError && roleData) {
        // Get admin details
        const { data: adminData, error: adminError } = await supabase
          .from("admin_users")
          .select("id, email, full_name, role")
          .eq("user_id", currentSession.user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (adminError) throw adminError;

        if (adminData) {
          setAdmin({
            id: adminData.id,
            email: adminData.email,
            full_name: adminData.full_name,
            role: adminData.role
          });
          setSession(currentSession);
        } else {
          setAdmin(null);
          setSession(null);
        }
      } else {
        setAdmin(null);
        setSession(null);
      }
    } catch (error) {
      console.error("Admin verification failed:", error);
      setAdmin(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        verifyAdmin(session);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          verifyAdmin(session);
        } else {
          setAdmin(null);
          setSession(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.session) throw new Error("No session returned");

      // Check admin role directly from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) throw new Error("You don't have admin access");

      // Get admin details
      const { data: adminData, error: adminError } = await supabase
        .from("admin_users")
        .select("id, email, full_name, role")
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (adminError) throw adminError;
      if (!adminData) throw new Error("Admin account is not active");

      setSession(authData.session);
      setAdmin({
        id: adminData.id,
        email: adminData.email,
        full_name: adminData.full_name,
        role: adminData.role
      });

      // Log admin login (fire and forget, don't await)
      supabase.from("security_events").insert({
        event_type: "admin_login",
        user_id: authData.user.id,
        details: { email, timestamp: new Date().toISOString() }
      });

      toast({
        title: "Welcome back!",
        description: `Logged in as ${adminData.full_name}`,
      });
    } catch (error: any) {
      console.error("Admin sign in error:", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid credentials",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Log admin logout to security events
      if (session?.user?.id) {
        await supabase.from("security_events").insert({
          event_type: "admin_logout",
          user_id: session.user.id,
          details: { timestamp: new Date().toISOString() }
        });
      }
      
      await supabase.auth.signOut();
      setAdmin(null);
      setSession(null);
      
      toast({
        title: "Signed out",
        description: "You have been logged out successfully",
      });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <AdminContext.Provider value={{ admin, session, loading, signIn, signOut }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};
