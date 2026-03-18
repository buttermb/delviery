import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { performFullLogout } from "@/lib/utils/authHelpers";

interface VendorProfile {
    id: string;
    tenant_id: string;
    business_name: string;
    marketplace_status: string;
    can_sell: boolean;
}

interface VendorAuthContextType {
    vendor: VendorProfile | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const VendorAuthContext = createContext<VendorAuthContextType | undefined>(undefined);

export const VendorAuthProvider = ({ children }: { children: ReactNode }) => {
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                checkUser();
            } else {
                setVendor(null);
                setIsAuthenticated(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }

            // 1. Find tenant_user record
            const { data: tenantUser, error: tenantError } = await supabase
                .from('tenant_users')
                .select('tenant_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (tenantError || !tenantUser) {
                logger.warn('User is not a tenant user', { userId: session.user.id });
                setLoading(false);
                return;
            }

            // 2. Find marketplace_profile
            const { data: profile, error: profileError } = await supabase
                .from('marketplace_profiles')
                .select('id, tenant_id, business_name, marketplace_status, can_sell')
                .eq('tenant_id', tenantUser.tenant_id)
                .maybeSingle();

            if (profileError) {
                logger.error('Error fetching vendor profile', profileError);
                setLoading(false);
                return;
            }

            if (profile) {
                setVendor(profile);
                setIsAuthenticated(true);
            } else {
                // User is a tenant, but not a vendor (no marketplace profile)
                logger.warn('Tenant has no marketplace profile', { tenantId: tenantUser.tenant_id });
            }

        } catch (error) {
            logger.error('Vendor auth check failed', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    const logout = async () => {
        // Perform complete state cleanup (encryption, Supabase, storage, query cache)
        await performFullLogout();

        // Clear context-specific React state
        setVendor(null);
        setIsAuthenticated(false);
    };

    return (
        <VendorAuthContext.Provider value={{ vendor, loading, isAuthenticated, login, logout }}>
            {children}
        </VendorAuthContext.Provider>
    );
};

export const useVendorAuth = () => {
    const context = useContext(VendorAuthContext);
    if (context === undefined) {
        throw new Error('useVendorAuth must be used within a VendorAuthProvider');
    }
    return context;
};
