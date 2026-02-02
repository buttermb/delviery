/**
 * Impersonation Banner
 * Displays a warning banner when a super admin is impersonating a tenant
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import LogOut from "lucide-react/dist/esm/icons/log-out";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { supabase } from '@/integrations/supabase/client';

export function ImpersonationBanner() {
    const navigate = useNavigate();
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [tenantName, setTenantName] = useState<string>('');

    useEffect(() => {
        const checkImpersonation = async () => {
            const impersonating = localStorage.getItem('impersonating_tenant');
            const tenantId = localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_TENANT_ID);

            if (impersonating === 'true' && tenantId) {
                setIsImpersonating(true);

                // Fetch tenant name if not already known
                // In a real app, we might store the name in localStorage too to avoid a fetch
                // But fetching ensures we have the latest name
                const { data } = await supabase
                    .from('tenants')
                    .select('business_name')
                    .eq('id', tenantId)
                    .maybeSingle();

                if (data) {
                    setTenantName(data.business_name);
                }
            } else {
                setIsImpersonating(false);
            }
        };

        checkImpersonation();

        // Listen for storage changes to update banner in real-time if multiple tabs
        window.addEventListener('storage', checkImpersonation);
        return () => window.removeEventListener('storage', checkImpersonation);
    }, []);

    const handleExitImpersonation = () => {
        localStorage.removeItem('impersonating_tenant');
        localStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_TENANT_ID);
        localStorage.removeItem('impersonation_timestamp');

        setIsImpersonating(false);
        navigate('/saas/admin/enhanced');
    };

    if (!isImpersonating) return null;

    return (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-md z-50 relative">
            <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-5 w-5" />
                <span>
                    Viewing as <span className="font-bold underline">{tenantName || 'Tenant'}</span>
                </span>
                <span className="text-amber-100 text-sm hidden sm:inline">
                    (Super Admin Mode)
                </span>
            </div>
            <Button
                variant="secondary"
                size="sm"
                onClick={handleExitImpersonation}
                className="bg-white text-amber-600 hover:bg-amber-50 border-none font-semibold h-8"
            >
                <LogOut className="h-4 w-4 mr-2" />
                Exit Impersonation
            </Button>
        </div>
    );
}
