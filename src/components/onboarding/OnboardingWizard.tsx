import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, ArrowRight, Store, Truck, Users, Coins } from "lucide-react";
import { logger } from "@/lib/logger";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCredits } from "@/hooks/useCredits";
import { CreditSystemExplainer } from "@/components/signup/CreditSystemExplainer";

interface OnboardingWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const { isFreeTier } = useCredits();

    // Free tier users get an extra "credits" step
    const totalSteps = isFreeTier ? 4 : 3;

    const handleComplete = async () => {
        if (!tenant?.id) return;

        setLoading(true);

        // Create timeout protection
        const timeoutId = setTimeout(() => {
            setLoading(false);
            toast({
                title: "Request Timeout",
                description: "The save operation took too long. Please try again.",
                variant: "destructive",
            });
        }, 10000); // 10 second timeout

        try {
            const { error } = await supabase
                .from("tenants")
                .update({
                    onboarding_completed: true,
                    onboarding_completed_at: new Date().toISOString(),
                })
                .eq("id", tenant.id);

            // Clear timeout if operation completes
            clearTimeout(timeoutId);

            if (error) throw error;

            toast({
                title: "Setup Complete!",
                description: "Welcome to your new dashboard.",
            });

            // Close dialog after brief delay to show success message
            setTimeout(() => {
                onOpenChange(false);
            }, 500);
        } catch (error: any) {
            clearTimeout(timeoutId);
            logger.error("Failed to complete onboarding", error, { component: "OnboardingWizard" });
            toast({
                title: "Error",
                description: error?.message || "Failed to save progress. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSkipOnboarding = async () => {
        if (!tenant?.id) return;

        setLoading(true);

        try {
            const { error } = await supabase
                .from("tenants")
                .update({
                    onboarding_completed: true,
                    onboarding_skipped: true,
                    onboarding_completed_at: new Date().toISOString(),
                })
                .eq("id", tenant.id);

            if (error) throw error;

            toast({
                title: "Skipped Setup",
                description: "You can complete setup anytime from Settings.",
            });

            onOpenChange(false);
        } catch (error: any) {
            logger.error("Failed to skip onboarding", error, { component: "OnboardingWizard" });
            toast({
                title: "Error",
                description: error?.message || "Failed to save. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShortcut = async (path: string) => {
        if (!tenant?.id) return;
        setLoading(true);
        try {
            // Mark onboarding as complete
            const { error } = await supabase
                .from("tenants")
                .update({
                    onboarding_completed: true,
                    onboarding_completed_at: new Date().toISOString(),
                })
                .eq("id", tenant.id);

            if (error) throw error;

            toast({
                title: "Setup Saved",
                description: "Redirecting you now...",
            });

            onOpenChange(false);

            // Short delay to ensure dialog closes smoothly
            setTimeout(() => {
                navigate(path);
            }, 300);

        } catch (error: any) {
            logger.error("Failed to save shortcut progress", error, { component: "OnboardingWizard" });
            // Navigate anyway so user isn't stuck
            onOpenChange(false);
            navigate(path);
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            handleComplete();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
                <div className="bg-muted/30 p-6 border-b">
                    <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl">Welcome to FloraIQ</DialogTitle>
                            <DialogDescription>
                                Let's get your account set up in just a few steps.
                            </DialogDescription>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">
                            Step {step} of {totalSteps}
                        </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-in-out"
                            style={{ width: `${(step / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="p-6 min-h-[300px]">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                                    <Store className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Set Up Your Store</h3>
                                    <p className="text-muted-foreground">Configure your business details and preferences.</p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div
                                    className="p-4 border rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer touch-manipulation min-h-[44px]"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleShortcut(`/${tenant?.slug}/admin/settings`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleShortcut(`/${tenant?.slug}/admin/settings`);
                                        }
                                    }}
                                >
                                    <h4 className="font-medium mb-1">Business Profile</h4>
                                    <p className="text-sm text-muted-foreground">Add your logo, address, and contact info.</p>
                                </div>
                                <div
                                    className="p-4 border rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer touch-manipulation min-h-[44px]"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleShortcut(`/${tenant?.slug}/admin/settings`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleShortcut(`/${tenant?.slug}/admin/settings`);
                                        }
                                    }}
                                >
                                    <h4 className="font-medium mb-1">Operating Hours</h4>
                                    <p className="text-sm text-muted-foreground">Set when you're open for business.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                                    <Truck className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Delivery Settings</h3>
                                    <p className="text-muted-foreground">Define where and how you deliver.</p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div
                                    className="p-4 border rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer touch-manipulation min-h-[44px]"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleShortcut(`/${tenant?.slug}/admin/settings`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleShortcut(`/${tenant?.slug}/admin/settings`);
                                        }
                                    }}
                                >
                                    <h4 className="font-medium mb-1">Delivery Zones</h4>
                                    <p className="text-sm text-muted-foreground">Draw your delivery areas on the map.</p>
                                </div>
                                <div
                                    className="p-4 border rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer touch-manipulation min-h-[44px]"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleShortcut(`/${tenant?.slug}/admin/team`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleShortcut(`/${tenant?.slug}/admin/team`);
                                        }
                                    }}
                                >
                                    <h4 className="font-medium mb-1">Driver Management</h4>
                                    <p className="text-sm text-muted-foreground">Invite your drivers or connect 3rd party fleets.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Credits Step - Only for free tier users */}
                    {step === 3 && isFreeTier && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-full">
                                    <Coins className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Your Free Credits</h3>
                                    <p className="text-muted-foreground">Understanding how credits work.</p>
                                </div>
                            </div>

                            <CreditSystemExplainer variant="compact" />
                        </div>
                    )}

                    {/* Team & Access Step - Step 3 for paid, Step 4 for free */}
                    {((step === 3 && !isFreeTier) || (step === 4 && isFreeTier)) && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                                    <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Team & Access</h3>
                                    <p className="text-muted-foreground">Invite your team members.</p>
                                </div>
                            </div>

                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                <h4 className="text-lg font-medium mb-2">You're All Set!</h4>
                                <p className="text-muted-foreground mb-4">
                                    Your dashboard is ready. You can always change these settings later.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/10 border-t">
                    <div className="flex w-full justify-between items-center">
                        <Button
                            variant="ghost"
                            onClick={handleSkipOnboarding}
                            disabled={loading}
                        >
                            Skip for now
                        </Button>
                        <div className="flex gap-2">
                            {step > 1 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(step - 1)}
                                    disabled={loading}
                                >
                                    Back
                                </Button>
                            )}
                            <Button onClick={nextStep} disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : step === totalSteps ? (
                                    "Get Started"
                                ) : (
                                    <>
                                        Next Step
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
