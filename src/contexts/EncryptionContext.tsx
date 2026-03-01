// src/contexts/EncryptionContext.tsx

import { createContext, useContext, ReactNode } from 'react';
import { useEncryption } from '@/lib/hooks/useEncryption';
import type { EncryptionHookResult } from '@/lib/encryption/types';

// Additional context-specific methods can be added here
type EncryptionContextType = EncryptionHookResult;

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const encryption = useEncryption();

  return (
    <EncryptionContext.Provider value={encryption}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryptionContext(): EncryptionContextType {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error('useEncryptionContext must be used within EncryptionProvider');
  }
  return context;
}

