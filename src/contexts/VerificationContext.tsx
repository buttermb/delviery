/**
 * Verification Context
 * Tracks verification state across the app to prevent premature WebSocket connections
 */

import { createContext, useContext, useState, ReactNode } from 'react';

interface VerificationContextType {
  isVerified: boolean;
  isVerifying: boolean;
  verificationError: string | null;
  setIsVerified: (verified: boolean) => void;
  setIsVerifying: (verifying: boolean) => void;
  setVerificationError: (error: string | null) => void;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

export function VerificationProvider({ children }: { children: ReactNode }) {
  // Start with verifying state - protected routes will set verified after local checks
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  return (
    <VerificationContext.Provider
      value={{
        isVerified,
        isVerifying,
        verificationError,
        setIsVerified,
        setIsVerifying,
        setVerificationError,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
}
