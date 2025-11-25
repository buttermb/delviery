import { logger } from '@/lib/logger';
import { logAuth, logAuthWarn, logAuthError } from '@/lib/debug/logger';
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clientEncryption } from "@/lib/encryption/clientEncryption";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session synchronously
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        // Debug: Log initial session state
        logAuth('Initial session loaded', {
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          authMethod: session?.user?.app_metadata?.provider,
          source: 'AuthContext'
        });
        logger.debug('Initial session', { hasSession: !!session, component: 'AuthContext' });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Debug: Log auth state changes
        logAuth(`Auth state changed: ${event}`, {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          authMethod: session?.user?.app_metadata?.provider,
          source: 'AuthContext'
        });
        logger.debug('Auth state change', { event, hasSession: !!session, component: 'AuthContext' });

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Debug: Log sign out attempt
      logAuth('Sign out initiated', {
        userId: user?.id,
        userEmail: user?.email,
        source: 'AuthContext'
      });

      // Destroy encryption session before signing out
      clientEncryption.destroy();

      await supabase.auth.signOut();
      setUser(null);
      setSession(null);

      // Clear user ID from storage
      sessionStorage.removeItem('floraiq_user_id');
      localStorage.removeItem('floraiq_user_id');

      // Debug: Log successful sign out
      logAuth('Sign out completed', { source: 'AuthContext' });
    } catch (error) {
      logAuthError('Sign out failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthContext'
      });
      logger.error("Error signing out", error instanceof Error ? error : new Error(String(error)), { component: 'AuthContext' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
