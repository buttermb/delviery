/**
 * Safe Clerk hooks that don't throw when Clerk isn't configured
 * Returns default values when ClerkProvider is not available
 */
import { useClerkConfigured } from '@/providers/ClerkProviderWrapper';
import * as ClerkReact from '@clerk/clerk-react';

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
  user: unknown | null;
  isLoaded: boolean;
}

const defaultAuth: SafeAuthReturn = {
  isSignedIn: undefined,
  isLoaded: true,
  userId: undefined,
  sessionId: undefined,
  getToken: undefined,
};

const defaultUser: SafeUserReturn = {
  user: null,
  isLoaded: true,
};

/**
 * Safe wrapper for useAuth that returns defaults when Clerk isn't configured
 */
export function useAuthSafe(): SafeAuthReturn {
  const clerkConfigured = useClerkConfigured();
  
  // Only call useAuth if Clerk is configured
  if (!clerkConfigured) {
    return defaultAuth;
  }
  
  // Use try-catch to safely call Clerk hooks
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = ClerkReact.useAuth();
    return {
      isSignedIn: auth.isSignedIn,
      isLoaded: auth.isLoaded,
      userId: auth.userId,
      sessionId: auth.sessionId,
      getToken: auth.getToken,
    };
  } catch {
    return defaultAuth;
  }
}

/**
 * Safe wrapper for useUser that returns defaults when Clerk isn't configured
 */
export function useUserSafe(): SafeUserReturn {
  const clerkConfigured = useClerkConfigured();
  
  if (!clerkConfigured) {
    return defaultUser;
  }
  
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user, isLoaded } = ClerkReact.useUser();
    return { user, isLoaded };
  } catch {
    return defaultUser;
  }
}
