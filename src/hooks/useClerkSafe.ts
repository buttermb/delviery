/**
 * Safe Clerk hooks that don't throw when Clerk isn't configured
 * Returns default values when ClerkProvider is not available
 */
import { useAuth, useUser } from '@clerk/clerk-react';
import { useClerkConfigured } from '@/providers/ClerkProviderWrapper';

interface GetTokenOptions {
  template?: string;
  leewayInSeconds?: number;
  skipCache?: boolean;
}

interface SafeAuthReturn {
  isSignedIn: boolean | undefined;
  isLoaded: boolean;
  userId: string | null | undefined;
  sessionId: string | null | undefined;
  getToken: ((options?: GetTokenOptions) => Promise<string | null>) | undefined;
}

interface SafeUserReturn {
  user: ReturnType<typeof useUser>['user'] | null;
  isLoaded: boolean;
}

/**
 * Safe wrapper for useAuth that returns defaults when Clerk isn't configured
 */
export function useAuthSafe(): SafeAuthReturn {
  const clerkConfigured = useClerkConfigured();
  
  // Only call useAuth if Clerk is configured
  // This is safe because useClerkConfigured is a simple boolean check
  // and the component tree structure doesn't change
  if (!clerkConfigured) {
    return {
      isSignedIn: undefined,
      isLoaded: true, // Treat as loaded since we're not using Clerk
      userId: undefined,
      sessionId: undefined,
      getToken: undefined,
    };
  }
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const auth = useAuth();
  return {
    isSignedIn: auth.isSignedIn,
    isLoaded: auth.isLoaded,
    userId: auth.userId,
    sessionId: auth.sessionId,
    getToken: auth.getToken,
  };
}

/**
 * Safe wrapper for useUser that returns defaults when Clerk isn't configured
 */
export function useUserSafe(): SafeUserReturn {
  const clerkConfigured = useClerkConfigured();
  
  if (!clerkConfigured) {
    return {
      user: null,
      isLoaded: true, // Treat as loaded since we're not using Clerk
    };
  }
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, isLoaded } = useUser();
  return { user, isLoaded };
}
