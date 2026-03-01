import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { safeStorage } from '@/utils/safeStorage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface StorefrontAgeGateProps {
    storeId?: string;
}

interface StoreAgeSettings {
    enable_age_gate?: boolean;
    age_gate_min_age?: number;
}

export function StorefrontAgeGate({ storeId }: StorefrontAgeGateProps) {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const [isVisible, setIsVisible] = useState(false);
    const [_isVerified, setIsVerified] = useState(false);
    // Use storeSlug-namespaced key to avoid cross-store contamination if hosting multiple
    const storageKey = `age_verified_${storeSlug || storeId || 'default'}`;

    // Fetch store settings to check if age gate is enabled
    // Note: These columns may not exist yet, so we handle errors gracefully
    const { data: settings } = useQuery({
        queryKey: queryKeys.storeAgeSettings.byStore(storeId),
        queryFn: async (): Promise<StoreAgeSettings | null> => {
            if (!storeId) return null;
            try {
                // Try to fetch settings - the columns may not exist yet
                const { data, error } = await supabase
                    .from('marketplace_stores')
                    .select('*')
                    .eq('id', storeId)
                    .maybeSingle();

                if (error) {
                    logger.warn('Age gate settings not available', error);
                    return null;
                }

                // Check if the age gate columns exist in the response
                const storeData = data as Record<string, unknown> | null;
                if (storeData && 'enable_age_gate' in storeData) {
                    return {
                        enable_age_gate: storeData.enable_age_gate as boolean,
                        age_gate_min_age: (storeData.age_gate_min_age as number) || 21,
                    };
                }

                return null;
            } catch (err) {
                logger.warn('Failed to fetch age gate settings', err);
                return null;
            }
        },
        enabled: !!storeId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    useEffect(() => {
        // If settings haven't loaded yet or feature disabled, do nothing
        if (!settings) return;
        if (settings.enable_age_gate === false) return;

        const verified = safeStorage.getItem(storageKey);
        if (!verified) {
            setIsVisible(true);
            // Disable scrolling while active
            document.body.style.overflow = 'hidden';
        } else {
            setIsVerified(true);
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [settings, storageKey]);

    const handleVerify = () => {
        setIsVisible(false);
        setIsVerified(true);
        safeStorage.setItem(storageKey, 'true');
        document.body.style.overflow = '';
    };

    const handleReject = () => {
        window.location.href = 'https://www.google.com';
    };

    if (!isVisible) return null;

    const minAge = settings?.age_gate_min_age || 21;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-max bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="w-full max-w-md bg-zinc-950 border-zinc-800 text-white shadow-2xl" data-dark-panel data-testid="age-verification-modal">
                        <CardHeader className="text-center space-y-4 pt-8">
                            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-2">
                                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                            </div>
                            <CardTitle className="text-2xl font-light tracking-wide">
                                Age Verification
                            </CardTitle>
                            <CardDescription className="text-zinc-400 text-base">
                                You must be at least <span className="text-white font-bold">{minAge}</span> years old to access this site.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-8">
                            <Button
                                className="w-full h-12 text-lg font-medium bg-white text-black hover:bg-zinc-200 transition-colors"
                                onClick={handleVerify}
                            >
                                I am {minAge}+
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full h-12 text-lg font-medium border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                                onClick={handleReject}
                            >
                                Leave Site
                            </Button>
                            <p className="text-center text-xs text-zinc-600 mt-4">
                                By entering, you agree to our Terms of Service and Privacy Policy.
                                Access to this site is restricted to adults of legal age.
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
