/**
 * PaymentSettingsTab — Wrapper for PaymentSettingsForm
 * Loads tenant payment settings and wires up save logic.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentSettingsForm, type PaymentSettingsFormData } from '@/components/settings/PaymentSettingsForm';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';

export default function PaymentSettingsTab() {
    const { tenant } = useTenantAdminAuth();
    const [initialData, setInitialData] = useState<Partial<PaymentSettingsFormData> | undefined>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenant?.id) {
            setLoading(false);
            return;
        }

        const load = async () => {
            try {
                const { data, error } = await supabase
                    .from('tenant_payment_settings')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .maybeSingle();

                if (error) {
                    logger.error('Failed to load payment settings', { error });
                }

                if (data) {
                    setInitialData(data as Partial<PaymentSettingsFormData>);
                }
            } catch (err) {
                logger.error('Error loading payment settings', { err });
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [tenant?.id]);

    const handleSave = async (formData: PaymentSettingsFormData) => {
        if (!tenant?.id) throw new Error('No tenant');

        const payload = {
            tenant_id: tenant.id,
            ...formData,
        };

        // Upsert — insert if missing, update if exists
        const { error } = await supabase
            .from('tenant_payment_settings')
            .upsert(payload, { onConflict: 'tenant_id' });

        if (error) {
            logger.error('Failed to save payment settings', { error });
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="p-2 sm:p-6">
            <PaymentSettingsForm
                initialData={initialData}
                onSave={handleSave}
                isLoading={loading}
            />
        </div>
    );
}
