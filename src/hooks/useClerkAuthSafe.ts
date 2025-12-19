/**
 * Safe Clerk Auth Hook
 * Returns safe defaults when Clerk is not configured
 * Prevents "useAuth can only be used within ClerkProvider" errors
 */

import { useClerkConfigured } from '@/providers/ClerkProviderWrapper';

interface ClerkAuthSafe {
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  sessionId: string | null;
}

/**
 * Hook that provides Clerk auth state safely
 * When Clerk is not configured, returns safe defaults
 * 
 * IMPORTANT: This hook does NOT call useAuth() - it only checks configuration
 * Components that need actual Clerk auth should be conditionally rendered
 */
export function useClerkAuthSafe(): ClerkAuthSafe & { clerkConfigured: boolean } {
  const clerkConfigured = useClerkConfigured();
  
  // Return safe defaults when Clerk is not configured
  // Actual Clerk auth calls should happen in conditionally rendered components
  return {
    clerkConfigured,
    isSignedIn: false,
    isLoaded: true,
    userId: null,
    sessionId: null,
  };
}
