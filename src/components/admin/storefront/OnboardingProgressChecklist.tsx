import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, Package, Palette, Globe, ArrowRight } from "lucide-react";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { cn } from "@/lib/utils";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    isComplete: boolean;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    icon: React.ElementType;
}

interface OnboardingProgressChecklistProps {
    productCount: number;
    storeIsActive: boolean;
    storeHasCustomization: boolean;
    className?: string;
}

export function OnboardingProgressChecklist({
    productCount,
    storeIsActive,
    storeHasCustomization,
    className,
}: OnboardingProgressChecklistProps) {
    const navigateTenant = useTenantNavigate();

    const steps: OnboardingStep[] = [
        {
            id: "products",
            title: "Add your first product",
            description: "Upload products to start selling",
            isComplete: productCount > 0,
            action: {
                label: "Add Product",
                href: "/admin/products",
            },
            icon: Package,
        },
        {
            id: "customize",
            title: "Customize your store",
            description: "Add logo, colors, and branding",
            isComplete: storeHasCustomization,
            action: {
                label: "Customize",
                href: "/admin/storefront/builder",
            },
            icon: Palette,
        },
        {
            id: "launch",
            title: "Go live!",
            description: "Launch your store to customers",
            isComplete: storeIsActive,
            action: {
                label: "Launch Store",
                onClick: () => {
                    // This would trigger the store activation - handled by parent
                },
            },
            icon: Globe,
        },
    ];

    const completedCount = steps.filter((s) => s.isComplete).length;
    const allComplete = completedCount === steps.length;

    // Don't show if all steps are complete
    if (allComplete) return null;

    return (
        <Card className={cn("border-primary/20", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        Getting Started
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {completedCount}/{steps.length} complete
                        </span>
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isNext = !step.isComplete && steps.slice(0, index).every((s) => s.isComplete);

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    "flex items-center gap-4 p-3 rounded-lg transition-colors",
                                    step.isComplete && "bg-green-50 dark:bg-green-900/10",
                                    isNext && "bg-primary/5 border border-primary/20",
                                    !step.isComplete && !isNext && "opacity-50"
                                )}
                            >
                                {/* Status Icon */}
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                        step.isComplete
                                            ? "bg-green-500 text-white"
                                            : isNext
                                                ? "bg-primary text-white"
                                                : "bg-muted"
                                    )}
                                >
                                    {step.isComplete ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Icon className="w-4 h-4" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p
                                        className={cn(
                                            "font-medium",
                                            step.isComplete && "line-through text-muted-foreground"
                                        )}
                                    >
                                        {step.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{step.description}</p>
                                </div>

                                {/* Action Button */}
                                {isNext && step.action && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            if (step.action?.href) {
                                                navigateTenant(step.action.href);
                                            } else if (step.action?.onClick) {
                                                step.action.onClick();
                                            }
                                        }}
                                        className="shrink-0"
                                    >
                                        {step.action.label}
                                        <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                )}

                                {step.isComplete && (
                                    <span className="text-xs text-green-600 font-medium shrink-0">Done!</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
