/**
 * CreditContext - Unified Credit Provider
 * 
 * Re-exports useCredits from hooks and adds modal state management.
 * This provides backwards compatibility while consolidating on the hook.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useCredits as useCreditsHook, type UseCreditsReturn } from '@/hooks/useCredits';
import { toast } from 'sonner';

interface CreditContextType extends UseCreditsReturn {
  // Legacy properties for backwards compatibility
  credits: number;
  showLowCreditWarning: boolean;
  dismissLowCreditWarning: () => void;
  isPurchaseModalOpen: boolean;
  setIsPurchaseModalOpen: (open: boolean) => void;
  // Legacy method
  deductCredits: (amount: number, actionName: string) => boolean;
  addCredits: (amount: number) => void;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
};

export const CreditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const creditsHook = useCreditsHook();
  const [showLowCreditWarning, setShowLowCreditWarning] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);

  // Show low credit warning once per session
  React.useEffect(() => {
    if (creditsHook.isLowCredits && !hasShownWarning && !creditsHook.isLoading) {
      const hasWarned = sessionStorage.getItem('low_credit_warning_shown');
      if (!hasWarned) {
        setShowLowCreditWarning(true);
        sessionStorage.setItem('low_credit_warning_shown', 'true');
        setHasShownWarning(true);
      }
    }
  }, [creditsHook.isLowCredits, creditsHook.isLoading, hasShownWarning]);

  const dismissLowCreditWarning = useCallback(() => {
    setShowLowCreditWarning(false);
  }, []);

  // Legacy deductCredits method for backwards compatibility
  const deductCredits = useCallback((amount: number, _actionName: string): boolean => {
    if (creditsHook.balance < amount) {
      toast.error('Insufficient Credits', {
        description: `You need ${amount} credits for this action, but only have ${creditsHook.balance}.`,
        action: {
          label: 'Buy Credits',
          onClick: () => setIsPurchaseModalOpen(true),
        }
      });
      return false;
    }
    return true;
  }, [creditsHook.balance]);

  // Legacy addCredits method
  const addCredits = useCallback((amount: number) => {
    creditsHook.refetch();
    toast.success('Credits added', {
      description: `${amount.toLocaleString()} credits have been added to your account`,
    });
  }, [creditsHook]);

  return (
    <CreditContext.Provider
      value={{
        ...creditsHook,
        // Legacy alias
        credits: creditsHook.balance,
        showLowCreditWarning,
        dismissLowCreditWarning,
        isPurchaseModalOpen,
        setIsPurchaseModalOpen,
        deductCredits,
        addCredits,
      }}
    >
      {children}
    </CreditContext.Provider>
  );
};
