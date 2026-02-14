import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

interface TrialExpirationBannerProps {
    daysRemaining: number;
    hasPaymentMethod: boolean;
    trialEndsAt: string;
}

export function TrialExpirationBanner({
    daysRemaining,
    hasPaymentMethod,
    trialEndsAt: _trialEndsAt
}: TrialExpirationBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    const navigate = useNavigate();
    const { tenant } = useTenantAdminAuth();

    // Don't show if dismissed or if payment method already added
    if (dismissed || hasPaymentMethod) return null;

    // Only show when trial is ending soon (7 days or less)
    if (daysRemaining > 7) return null;

    const getVariant = () => {
        if (daysRemaining <= 1) return "destructive";
        if (daysRemaining <= 3) return "default";
        return "default";
    };

    const getMessage = () => {
        if (daysRemaining === 0) {
            return {
                title: "⛔ Your trial has ended",
                description: "Add a payment method now to avoid service interruption. Your account will be suspended without payment details.",
            };
        } else if (daysRemaining === 1) {
            return {
                title: "⚠️ Your trial ends tomorrow",
                description: "Add a payment method today to ensure uninterrupted service. Without payment details, your account will be suspended.",
            };
        } else if (daysRemaining <= 3) {
            return {
                title: `🚨 Your trial ends in ${daysRemaining} days`,
                description: "Action required: Add a payment method to continue using your account after the trial period.",
            };
        } else {
            return {
                title: `⏰ Your trial ends in ${daysRemaining} days`,
                description: "Add a payment method to ensure a smooth transition when your trial period ends.",
            };
        }
    };

    const { title, description } = getMessage();

    const handleAddPayment = () => {
        navigate(`/${tenant?.slug}/admin/billing`);
    };

    return (
        <div className="relative">
            <Alert variant={getVariant()} className="mb-4 pr-12">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription className="mt-2 flex items-center justify-between">
                    <span>{description}</span>
                    <Button
                        size="sm"
                        onClick={handleAddPayment}
                        className="ml-4"
                    >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Add Payment Method
                    </Button>
                </AlertDescription>
                <button
                    onClick={() => setDismissed(true)}
                    className="absolute top-3 right-3 text-foreground/50 hover:text-foreground"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </Alert>
        </div>
    );
}
