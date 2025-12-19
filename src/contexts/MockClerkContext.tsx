/**
 * Mock Clerk Context
 * Provides default auth values when Clerk is not configured
 * This prevents "useAuth can only be used within ClerkProvider" errors
 */
import { createContext, useContext, ReactNode } from 'react';

interface MockAuthContextValue {
  isSignedIn: false;
  isLoaded: true;
  userId: null;
  sessionId: null;
  user: null;
  signOut: () => Promise<void>;
  getToken: () => Promise<null>;
}

const defaultValue: MockAuthContextValue = {
  isSignedIn: false,
  isLoaded: true,
  userId: null,
  sessionId: null,
  user: null,
  signOut: async () => {},
  getToken: async () => null,
};

const MockClerkContext = createContext<MockAuthContextValue>(defaultValue);

export function MockClerkProvider({ children }: { children: ReactNode }) {
  return (
    <MockClerkContext.Provider value={defaultValue}>
      {children}
    </MockClerkContext.Provider>
  );
}

export function useMockAuth() {
  return useContext(MockClerkContext);
}

export function useMockUser() {
  return { user: null, isLoaded: true };
}

