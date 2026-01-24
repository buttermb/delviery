import { logger } from '@/lib/logger';
import { logAuth, logAuthWarn, logAuthError } from '@/lib/debug/logger';
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clientEncryption } from "@/lib/encryption/clientEncryption";
import { performLogoutCleanup } from "@/lib/auth/logoutCleanup";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Set up auth state change listener FIRST to catch INITIAL_SESSION event.
    // Supabase fires INITIAL_SESSION when it restores a session from its own
    // localStorage, which happens before getSession() resolves.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logAuth(`Auth state changed: ${event}`, {
          event,
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          userEmail: currentSession?.user?.email,
          authMethod: currentSession?.user?.app_metadata?.provider,
          source: 'AuthContext'
        });
        logger.debug('Auth state change', { event, hasSession: !!currentSession, component: 'AuthContext' });

        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          // Mark loading complete on INITIAL_SESSION or if we haven't initialized yet
          if (event === 'INITIAL_SESSION' || !initializedRef.current) {
            initializedRef.current = true;
            setLoading(false);
          }
        }
      }
    );

    // Also call getSession() as a fallback to ensure loading resolves
    // even if onAuthStateChange doesn't fire (edge case)
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted && !initializedRef.current) {
        logAuth('Initial session loaded via getSession fallback', {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          userEmail: currentSession?.user?.email,
          authMethod: currentSession?.user?.app_metadata?.provider,
          source: 'AuthContext'
        });
        logger.debug('Initial session (fallback)', { hasSession: !!currentSession, component: 'AuthContext' });
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        initializedRef.current = true;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      logAuth('Sign out initiated', {
        userId: user?.id,
        userEmail: user?.email,
        source: 'AuthContext'
      });

      await supabase.auth.signOut();
      setUser(null);
      setSession(null);

      // Comprehensive cleanup: encryption, query cache, storage
      performLogoutCleanup({ queryClient, tier: 'base' });

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
