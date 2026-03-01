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
        title: 'Welcome to FloraIQ!',
        subtitle: "You're all set up. Let's get you started.",
        icon: <PartyPopper className="h-6 w-6" />,
        iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
    },
    {
        id: 'credits',
        title: 'Your Free Credits',
        subtitle: 'See how the credit system works.',
        icon: <Coins className="h-6 w-6" />,
        iconBg: 'bg-gradient-to-br from-green-500 to-emerald-500',
    },
    {
        id: 'limits',
        title: 'Free Tier Limits',
        subtitle: 'Understand your account boundaries.',
        icon: <AlertTriangle className="h-6 w-6" />,
        iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500',
    },
    {
        id: 'upgrade',
        title: 'Grow When Ready',
        subtitle: 'Upgrade anytime for unlimited access.',
        icon: <Crown className="h-6 w-6" />,
        iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-500',
    },
];

// ============================================================================
// Animation Variants
// ============================================================================

const pageVariants = {
    initial: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
    }),
    animate: {
        x: 0,
        opacity: 1,
        transition: {
            type: 'spring' as const,
            damping: 25,
            stiffness: 300,
        },
    },
    exit: (direction: number) => ({
        x: direction > 0 ? -300 : 300,
        opacity: 0,
        transition: {
            type: 'spring' as const,
            damping: 25,
            stiffness: 300,
        },
    }),
};

const confettiVariants = {
    initial: { y: -20, opacity: 0, scale: 0 },
    animate: (i: number) => ({
        y: 0,
        opacity: 1,
        scale: 1,
        transition: {
            delay: i * 0.1,
            type: 'spring' as const,
            damping: 10,
            stiffness: 200,
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && skip()}>
            <DialogContent className={cn(
                'sm:max-w-[600px] p-0 overflow-hidden gap-0 border-0',
                className
            )}>
                {/* Header */}
                <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white p-6 pb-8">
                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white/60 hover:text-white hover:bg-white/10"
                        onClick={handleSkip}
                        aria-label="Close onboarding"
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    {/* Background decoration */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex items-center gap-4">
                        <motion.div
                            key={currentConfig.id}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                            className={cn(
                                'p-3 rounded-2xl text-white shadow-lg',
                                currentConfig.iconBg
                            )}
                        >
                            {currentConfig.icon}
                        </motion.div>
                        <div>
                            <motion.h2
                                key={`title-${currentConfig.id}`}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xl font-bold"
                            >
                                {currentConfig.title}
                            </motion.h2>
                            <motion.p
                                key={`subtitle-${currentConfig.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.8 }}
                                transition={{ delay: 0.1 }}
                                className="text-sm text-white/70"
                            >
                                {currentConfig.subtitle}
                            </motion.p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                        <motion.div
                            className="h-full bg-gradient-to-r from-primary to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-6 min-h-[400px] overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={state.currentStep}
                            custom={direction}
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="h-full"
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
                <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
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

// ============================================================================
// Welcome Step Component
// ============================================================================

function WelcomeStep({ businessName }: { businessName: string }) {
    const emojis = ['🎉', '🔥', '🚀', '💫', '🌟'];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            {/* Confetti emojis */}
            <div className="flex gap-4 mb-2">
                {emojis.map((emoji, i) => (
                    <motion.span
                        key={i}
                        custom={i}
                        variants={confettiVariants}
                        initial="initial"
                        animate="animate"
                        className="text-3xl"
                    >
                        {emoji}
                    </motion.span>
                ))}
            </div>

            {/* Main content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-3"
            >
                <h3 className="text-2xl font-bold">
                    Welcome aboard, <span className="text-primary">{businessName}</span>!
                </h3>
                <p className="text-muted-foreground max-w-md">
                    Your account is ready to go. Let's take a quick tour of your free tier benefits
                    and how to make the most of FloraIQ.
                </p>
            </motion.div>

            {/* Feature highlights */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-3 gap-4 w-full max-w-sm pt-4"
            >
                {[
                    { icon: <Coins className="h-5 w-5" />, label: '500 Free Credits' },
                    { icon: <Rocket className="h-5 w-5" />, label: 'All Core Features' },
                    { icon: <Sparkles className="h-5 w-5" />, label: 'No CC Required' },
                ].map((item, i) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50"
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
                transition={{ delay: 0.9 }}
                className="text-sm text-muted-foreground"
            >
                This will only take <strong>30 seconds</strong> ⏱️
            </motion.p>
        </div>
    );
}

export default FreeTierOnboardingFlow;
