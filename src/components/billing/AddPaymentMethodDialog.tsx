import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";

interface AddPaymentMethodDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenantId: string;
}

export function AddPaymentMethodDialog({
    open,
    onOpenChange,
    tenantId,
    onSuccess,
}: AddPaymentMethodDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleAddPaymentMethod = async () => {
        if (!tenantId) {
            logger.error("Cannot add payment method: missing tenant_id", { component: "AddPaymentMethodDialog" });
            toast.error("Error", { description: "Unable to add payment method. Please try again." });
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("create-setup-session", {
                body: {
                    tenant_id: tenantId,
                    return_url: window.location.href,
                },
            });

            if (error) throw error;

            if (data?.url) {
                onSuccess?.();
                window.location.href = data.url;
            } else {
                throw new Error("No setup URL received");
            }
        } catch (error) {
            logger.error("Failed to create payment setup session", error, { component: "AddPaymentMethodDialog", tenantId });
            toast.error("Error", { description: "Failed to set up payment method. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Add Payment Method
                    </DialogTitle>
                    <DialogDescription>
                        Add a payment method to ensure uninterrupted service when your trial ends.
                        You won't be charged until your trial expires.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                        <p className="mb-2">Your trial includes:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Full access to all features</li>
                            <li>Unlimited products & customers</li>
                            <li>Priority support</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Remind Me Later
                    </Button>
                    <Button onClick={handleAddPaymentMethod} disabled={loading || !tenantId}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            "Add Payment Method"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
