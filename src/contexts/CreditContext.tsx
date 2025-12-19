import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

interface CreditContextType {
    credits: number;
    isLoading: boolean;
    deductCredits: (amount: number, actionName: string) => boolean;
    addCredits: (amount: number) => void;
    showLowCreditWarning: boolean;
    dismissLowCreditWarning: () => void;
    isPurchaseModalOpen: boolean;
    setIsPurchaseModalOpen: (open: boolean) => void;
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
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [showLowCreditWarning, setShowLowCreditWarning] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

    // Fetch credits from DB
    const { data: credits = 0, isLoading } = useQuery({
        queryKey: ['tenant-credits', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) return 0;
            const { data, error } = await supabase
                .from('tenant_credits')
                .select('balance')
                .eq('tenant_id', tenant.id)
                .maybeSingle();

            if (error) {
                logger.error('Error fetching credits', error, { component: 'CreditContext' });
            }
            return data?.balance || 0;
        },
        enabled: !!tenant?.id,
        refetchInterval: 30000 // Poll every 30s to keep fresh
    });

    // Check for low credits on load
    useEffect(() => {
        if (!isLoading && credits < 500 && credits > 0) {
            // Check session storage to only show once per session
            const hasWarned = sessionStorage.getItem('low_credit_warning_shown');
            if (!hasWarned) {
                setShowLowCreditWarning(true);
                sessionStorage.setItem('low_credit_warning_shown', 'true');
            }
        }
    }, [credits, isLoading]);

    const deductCredits = (amount: number, actionName: string): boolean => {
        // Optimistic check valid for UI, but real check happens on backend
        if (credits < amount) {
            toast.error('Insufficient Credits', {
                description: `You need ${amount} credits for this action, but only have ${credits}.`,
                action: {
                    label: 'Buy Credits',
                    onClick: () => setIsPurchaseModalOpen(true),
                }
            });
            return false;
        }

        // Note: Actual deduction for critical actions (like orders) 
        // happens via database triggers. This function is for UI feedback 
        // or client-side gated features.

        // Optimistic update if needed, but for now we rely on refetch/invalidation
        // or the action calling this should trigger a backend mutation.

        toast.success('Credits Applied', {
            description: `${actionName}: cost calculated`,
            duration: 2000,
        });

        return true;
    };

    const addCredits = async (amount: number) => {
        // After successful purchase, invalidate credits query to refresh balance
        queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });
        toast.success('Credits added', {
            description: `${amount.toLocaleString()} credits have been added to your account`,
        });
    };

    const dismissLowCreditWarning = () => {
        setShowLowCreditWarning(false);
    };

    return (
        <CreditContext.Provider
            value={{
                credits,
                isLoading,
                deductCredits,
                addCredits,
                showLowCreditWarning,
                dismissLowCreditWarning,
                isPurchaseModalOpen,
                setIsPurchaseModalOpen
            }}
        >
            {children}
        </CreditContext.Provider>
    );
};
