/**
 * FreeTierOnboardingFlow Component
 * 
 * A dedicated, animated onboarding experience for FREE tier users.
 * Features 4 steps: Welcome, Credits, Limits, and Upgrade Path.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    ArrowRight,
    ArrowLeft,
    X,
    Rocket,
    Coins,
    AlertTriangle,
    Crown,
    PartyPopper,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AnimatedCreditMeter } from './AnimatedCreditMeter';
import { FreeTierLimitsCard } from './FreeTierLimitsCard';
import { UpgradePathSection } from './UpgradePathSection';
import { useFreeTierOnboarding, type OnboardingStep } from '@/hooks/useFreeTierOnboarding';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

// ============================================================================
// Types
// ============================================================================

interface FreeTierOnboardingFlowProps {
    className?: string;
}

interface StepConfig {
    id: OnboardingStep;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
}

// ============================================================================
// Constants
// ============================================================================

const stepConfigs: StepConfig[] = [
    {
        id: 'welcome',
        title: 'Welcome to FloraIQ',
        subtitle: "You're all set up. Let's get you started.",
        icon: <Rocket className="h-6 w-6" />,
        iconBg: 'bg-primary/10 text-primary',
    },
    {
        id: 'credits',
        title: 'Your Free Credits',
        subtitle: 'See how the credit system works.',
        icon: <Coins className="h-6 w-6" />,
        iconBg: 'bg-primary/10 text-primary',
    },
    {
        id: 'limits',
        title: 'Free Tier Limits',
        subtitle: 'Understand your account boundaries.',
        icon: <AlertTriangle className="h-6 w-6" />,
        iconBg: 'bg-primary/10 text-primary',
    },
    {
        id: 'upgrade',
        title: 'Grow When Ready',
        subtitle: 'Upgrade anytime for unlimited access.',
        icon: <Crown className="h-6 w-6" />,
        iconBg: 'bg-primary/10 text-primary',
    },
];

// ============================================================================
// Animation Variants
// ============================================================================

const pageVariants = {
    initial: (direction: number) => ({
        x: direction > 0 ? 30 : -30,
        opacity: 0,
    }),
    animate: {
        x: 0,
        opacity: 1,
        transition: {
            duration: 0.3,
            ease: "easeOut"
        },
    },
    exit: (direction: number) => ({
        x: direction > 0 ? -30 : 30,
        opacity: 0,
        transition: {
            duration: 0.2,
            ease: "easeIn"
        },
    }),
};

// ============================================================================
// Component
// ============================================================================

export function FreeTierOnboardingFlow({ className }: FreeTierOnboardingFlowProps) {
    const { tenant } = useTenantAdminAuth();
    const {
        state,
        isOpen,
        nextStep,
        prevStep,
        complete,
        skip,
        dismiss,
        isFirstStep,
        isLastStep,
        progressPercent,
    } = useFreeTierOnboarding();

    const [direction, setDirection] = useState(1);
    const currentConfig = stepConfigs[state.stepIndex];

    const handleNext = () => {
        setDirection(1);
        if (isLastStep) {
            complete();
        } else {
            nextStep();
        }
    };

    const handlePrev = () => {
        setDirection(-1);
        prevStep();
    };

    const handleSkip = () => {
        skip();
    };

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && dismiss()}>
            <DialogContent className={cn(
                'sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 border-0',
                className
            )}>
                {/* Header */}
                <div className="relative shrink-0 bg-card text-foreground border-b border-border/40 p-6 pb-6">
                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        onClick={handleSkip}
                        aria-label="Close onboarding"
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    {/* Content */}
                    <div className="relative z-10 flex items-center gap-4">
                        <motion.div
                            key={currentConfig.id}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                'p-3 rounded-xl',
                                currentConfig.iconBg
                            )}
                        >
                            {currentConfig.icon}
                        </motion.div>
                        <div>
                            <motion.h2
                                key={`title-${currentConfig.id}`}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xl font-semibold text-foreground"
                            >
                                {currentConfig.title}
                            </motion.h2>
                            <motion.p
                                key={`subtitle-${currentConfig.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="text-sm text-muted-foreground"
                            >
                                {currentConfig.subtitle}
                            </motion.p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-6 flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={state.currentStep}
                            custom={direction}
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className=""
                        >
                            {state.currentStep === 'welcome' && (
                                <WelcomeStep businessName={tenant?.business_name || 'your business'} />
                            )}
                            {state.currentStep === 'credits' && (
                                <AnimatedCreditMeter />
                            )}
                            {state.currentStep === 'limits' && (
                                <FreeTierLimitsCard />
                            )}
                            {state.currentStep === 'upgrade' && (
                                <UpgradePathSection
                                    onContinueFree={complete}
                                    onUpgrade={complete}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="shrink-0 p-4 bg-muted/30 border-t flex items-center justify-between">
                    {/* Step indicators */}
                    <div className="flex items-center gap-1.5">
                        {stepConfigs.map((step, i) => (
                            <motion.div
                                key={step.id}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className={cn(
                                    'w-2 h-2 rounded-full transition-colors',
                                    i === state.stepIndex
                                        ? 'bg-primary w-6'
                                        : i < state.stepIndex
                                            ? 'bg-primary/50'
                                            : 'bg-muted-foreground/30'
                                )}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        {!isFirstStep && (
                            <Button variant="ghost" size="sm" onClick={handlePrev}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        )}
                        {isFirstStep && (
                            <Button variant="ghost" size="sm" onClick={handleSkip}>
                                Skip
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleNext}
                            className={cn(
                                isLastStep && 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                            )}
                        >
                            {isLastStep ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Get Started
                                </>
                            ) : (
                                <>
                                    Next
                                    <ArrowRight className="h-4 w-4 ml-1" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function WelcomeStep({ businessName }: { businessName: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 pt-4">
            {/* Main content */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
            >
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Rocket className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-semibold">
                    Welcome aboard, {businessName}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Your account is ready to go. Let's take a quick tour of your free tier benefits
                    and how to make the most of FloraIQ.
                </p>
            </motion.div>

            {/* Feature highlights */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="grid grid-cols-3 gap-4 w-full max-w-sm pt-4"
            >
                {[
                    { icon: <Coins className="h-5 w-5" />, label: '500 Free Credits' },
                    { icon: <Rocket className="h-5 w-5" />, label: 'All Core Features' },
                    { icon: <Sparkles className="h-5 w-5" />, label: 'No CC Required' },
                ].map((item, i) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border shadow-sm"
                    >
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {item.icon}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    </motion.div>
                ))}
            </motion.div>

            {/* Encouraging message */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-sm text-muted-foreground"
            >
                This will only take about <strong>30 seconds</strong>
            </motion.p>
        </div>
    );
}

export default FreeTierOnboardingFlow;
