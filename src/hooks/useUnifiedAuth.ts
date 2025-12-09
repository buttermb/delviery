/**
 * Unified Auth Hook
 * 
 * This hook provides authentication state that works whether Clerk is configured or not.
 * Use this instead of importing from @clerk/clerk-react directly.
 * 
 * Usage:
 *   import { useAuth, useUser } from '@/hooks/useUnifiedAuth';
 */

import * as ClerkReact from '@clerk/clerk-react';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = !!CLERK_PUBLISHABLE_KEY;

// Default values when Clerk is not configured
const defaultAuth = {
  isSignedIn: false as const,
  isLoaded: true,
  userId: null as string | null,
  sessionId: null as string | null,
  signOut: async () => {},
  getToken: async () => null as string | null,
};

const defaultUser = {
  user: null,
  isLoaded: true,
};

/**
 * useAuth - Safe authentication hook
 * Returns Clerk auth if configured, defaults otherwise
 */
export function useAuth() {
  if (!isClerkConfigured) {
    return defaultAuth;
  }
  
  // Use try-catch to safely call Clerk hooks
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return ClerkReact.useAuth();
  } catch {
    return defaultAuth;
  }
}

/**
 * useUser - Safe user hook
 * Returns Clerk user if configured, defaults otherwise
 */
export function useUser() {
  if (!isClerkConfigured) {
    return defaultUser;
  }
  
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return ClerkReact.useUser();
  } catch {
    return defaultUser;
  }
}

/**
 * useClerk - Safe Clerk instance hook
 */
export function useClerk() {
  if (!isClerkConfigured) {
    return null;
  }
  
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return ClerkReact.useClerk();
  } catch {
    return null;
  }
}

/**
 * Check if Clerk is configured
 */
export function isClerkEnabled(): boolean {
  return isClerkConfigured;
}

/**
 * SignIn and SignUp components - re-exported for convenience
 * These will only render when Clerk is configured
 */
export { SignIn, SignUp } from '@clerk/clerk-react';
