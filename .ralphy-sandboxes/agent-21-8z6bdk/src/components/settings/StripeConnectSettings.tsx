import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { logger } from "@/lib/logger";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export function StripeConnectSettings() {
    const { tenant } = useTenantAdminAuth();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [stripeStatus, setStripeStatus] = useState<{
        connected: boolean;
        details_submitted: boolean;
        charges_enabled: boolean;
        payouts_enabled: boolean;
    } | null>(null);

    useEffect(() => {
        if (tenant?.id) {
            checkStripeStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- checkStripeStatus is defined below, only run on tenant change
    }, [tenant?.id]);

    const checkStripeStatus = async () => {
        try {
            setCheckingStatus(true);
            const { data, error } = await supabase.functions.invoke('check-stripe-config', {
                body: { tenant_id: tenant?.id }
            });

            if (error) throw error;
            setStripeStatus(data);
        } catch (error: unknown) {
            logger.error('Failed to check Stripe status', error, { component: 'StripeConnectSettings' });
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleConnectStripe = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-stripe-connect', {
                body: {
                    tenant_id: tenant?.id,
                    return_url: window.location.href
                }
            });

            if (error) throw error;

            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error: unknown) {
            logger.error('Failed to start Stripe Connect', error, { component: 'StripeConnectSettings' });
            toast.error("Failed to connect to Stripe. Please try again.");
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return (
            <Card>
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Payment Processing
                    {stripeStatus?.charges_enabled && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Active
                        </span>
                    )}
                </CardTitle>
                <CardDescription>
                    Connect your Stripe account to accept payments directly from your customers.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {stripeStatus?.connected ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <div>
                                <h4 className="font-medium text-green-900 dark:text-green-100">Stripe Account Connected</h4>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Your account is set up to process payments.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="p-4 border rounded-lg">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Charges</div>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${stripeStatus.charges_enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <span className="font-medium">{stripeStatus.charges_enabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Payouts</div>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${stripeStatus.payouts_enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <span className="font-medium">{stripeStatus.payouts_enabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full sm:w-auto" asChild>
                            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                                View Stripe Dashboard <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-900 dark:text-blue-100">Setup Required</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    To start accepting payments, you need to connect a Stripe account. This allows you to receive payouts directly to your bank account.
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={handleConnectStripe}
                            disabled={loading}
                            className="w-full sm:w-auto bg-[#635BFF] hover:bg-[#5851E1] text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    Connect with Stripe
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
