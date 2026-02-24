/**
 * Onboarding Progress Tracker
 * Visual progress bar for tenant onboarding milestones
 */

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface OnboardingStep {
    id: string;
    label: string;
    completed: boolean;
    required: boolean;
}

interface OnboardingTrackerProps {
    tenant: {
        created_at: string;
        onboarded: boolean;
        usage?: {
            products: number;
            customers: number;
            orders?: number;
        };
        email_verified?: boolean;
        payment_method_attached?: boolean;
    };
}

export function OnboardingTracker({ tenant }: OnboardingTrackerProps) {
    // Calculate steps based on tenant data
    const steps: OnboardingStep[] = [
        {
            id: 'account',
            label: 'Account Created',
            completed: true,
            required: true
        },
        {
            id: 'email',
            label: 'Email Verified',
            completed: !!tenant.email_verified,
            required: true
        },
        {
            id: 'product',
            label: 'First Product',
            completed: (tenant.usage?.products ?? 0) > 0,
            required: true
        },
        {
            id: 'customer',
            label: 'First Customer',
            completed: (tenant.usage?.customers ?? 0) > 0,
            required: false
        },
        {
            id: 'billing',
            label: 'Billing Setup',
            completed: !!tenant.payment_method_attached,
            required: true
        }
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const progress = Math.round((completedCount / steps.length) * 100);

    // Determine status color using semantic tokens
    const getStatusColor = () => {
        if (progress === 100) return 'bg-success';

        const daysSinceCreation = (Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation > 7 && progress < 50) return 'bg-destructive'; // Stuck

        return 'bg-info';
    };

    const isStuck = (Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24) > 7 && progress < 100;

    return (
        <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Onboarding</span>
                <div className="flex items-center gap-2">
                    {isStuck && (
                        <Badge variant="destructive" className="h-4 px-1 text-[10px]">Stuck</Badge>
                    )}
                    <span className="font-bold">{progress}%</span>
                </div>
            </div>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Progress value={progress} className={`h-2 [&>div]:${getStatusColor()}`} />
                    </TooltipTrigger>
                    <TooltipContent className="w-64 p-3">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm mb-2">Onboarding Checklist</h4>
                            {steps.map((step) => (
                                <div key={step.id} className="flex items-center gap-2 text-xs">
                                    {step.completed ? (
                                        <CheckCircle className="h-3.5 w-3.5 text-success" />
                                    ) : (
                                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span className={step.completed ? 'text-foreground' : 'text-muted-foreground'}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
