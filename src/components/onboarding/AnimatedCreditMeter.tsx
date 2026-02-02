/**
 * AnimatedCreditMeter Component
 * 
 * A visually engaging animated meter that shows the FREE tier credit allocation.
 * Features spring animations, glow effects, and example credit deductions.
 */

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import Coins from "lucide-react/dist/esm/icons/coins";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Zap from "lucide-react/dist/esm/icons/zap";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import FileText from "lucide-react/dist/esm/icons/file-text";
import { cn } from '@/lib/utils';
import { FREE_TIER_MONTHLY_CREDITS } from '@/lib/credits';

// ============================================================================
// Types
// ============================================================================

interface AnimatedCreditMeterProps {
    onAnimationComplete?: () => void;
    className?: string;
    autoPlay?: boolean;
}

interface CreditExample {
    icon: React.ReactNode;
    action: string;
    cost: number;
    color: string;
}

// ============================================================================
// Constants
// ============================================================================

const creditExamples: CreditExample[] = [
    { icon: <FileText className="h-4 w-4" />, action: 'Create a menu', cost: 100, color: 'text-blue-500' },
    { icon: <ShoppingCart className="h-4 w-4" />, action: 'Receive order', cost: 75, color: 'text-green-500' },
    { icon: <MessageSquare className="h-4 w-4" />, action: 'Send SMS', cost: 25, color: 'text-purple-500' },
    { icon: <Zap className="h-4 w-4" />, action: 'POS sale', cost: 25, color: 'text-orange-500' },
];

// ============================================================================
// Component
// ============================================================================

export function AnimatedCreditMeter({
    onAnimationComplete,
    className,
    autoPlay = true,
}: AnimatedCreditMeterProps) {
    const [phase, setPhase] = useState<'filling' | 'examples' | 'complete'>('filling');
    const [showGlow, setShowGlow] = useState(false);
    const [activeExample, setActiveExample] = useState(-1);

    // Animated credit value
    const creditValue = useSpring(0, { damping: 30, stiffness: 80 });
    const displayCredits = useTransform(creditValue, (val) => Math.round(val));
    const [displayValue, setDisplayValue] = useState(0);

    // Progress percentage for meter fill
    const progressPercent = useTransform(creditValue, [0, FREE_TIER_MONTHLY_CREDITS], [0, 100]);
    const [progressValue, setProgressValue] = useState(0);

    // Subscribe to motion values
    useEffect(() => {
        const unsubCredits = displayCredits.on('change', (val) => setDisplayValue(val));
        const unsubProgress = progressPercent.on('change', (val) => setProgressValue(val));
        return () => {
            unsubCredits();
            unsubProgress();
        };
    }, [displayCredits, progressPercent]);

    // Animation sequence
    useEffect(() => {
        if (!autoPlay) return;

        // Phase 1: Fill up the meter
        const fillTimeout = setTimeout(() => {
            creditValue.set(FREE_TIER_MONTHLY_CREDITS);
        }, 500);

        // Phase 2: Show glow effect when full
        const glowTimeout = setTimeout(() => {
            setShowGlow(true);
            setPhase('examples');
        }, 2000);

        // Phase 3: Show examples with stagger
        const exampleTimeouts: ReturnType<typeof setTimeout>[] = [];
        creditExamples.forEach((_, index) => {
            exampleTimeouts.push(
                setTimeout(() => {
                    setActiveExample(index);
                }, 2500 + index * 600)
            );
        });

        // Phase 4: Complete
        const completeTimeout = setTimeout(() => {
            setPhase('complete');
            onAnimationComplete?.();
        }, 2500 + creditExamples.length * 600 + 500);

        return () => {
            clearTimeout(fillTimeout);
            clearTimeout(glowTimeout);
            exampleTimeouts.forEach(clearTimeout);
            clearTimeout(completeTimeout);
        };
    }, [autoPlay, creditValue, onAnimationComplete]);

    return (
        <div className={cn('space-y-6', className)}>
            {/* Main Credit Display */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="relative"
            >
                {/* Glow effect */}
                {showGlow && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-emerald-400/30 to-green-400/20 rounded-2xl blur-xl"
                    />
                )}

                {/* Credit card */}
                <div className="relative bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-2xl p-6 text-white overflow-hidden">
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-4 right-4">
                            <Coins className="h-32 w-32" />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-yellow-300" />
                            <span className="text-sm font-medium text-white/90">Your Starting Balance</span>
                        </div>

                        {/* Animated counter */}
                        <motion.div className="text-5xl font-bold tracking-tight mb-4">
                            {displayValue.toLocaleString()}
                            <span className="text-2xl ml-2 font-normal opacity-80">credits</span>
                        </motion.div>

                        {/* Progress bar */}
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-2">
                            <motion.div
                                className="h-full bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300 rounded-full"
                                style={{ width: `${progressValue}%` }}
                            />
                        </div>

                        <p className="text-sm text-white/80">
                            Refreshes monthly • No credit card required
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Credit Examples */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: phase !== 'filling' ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
            >
                <p className="text-sm font-medium text-muted-foreground">
                    Example credit usage:
                </p>

                <div className="grid gap-2">
                    {creditExamples.map((example, index) => (
                        <motion.div
                            key={example.action}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{
                                opacity: activeExample >= index ? 1 : 0.3,
                                x: activeExample >= index ? 0 : -20,
                            }}
                            transition={{
                                type: 'spring',
                                damping: 25,
                                stiffness: 400,
                                delay: index * 0.1
                            }}
                            className={cn(
                                'flex items-center justify-between p-3 rounded-lg border bg-card transition-colors',
                                activeExample === index && 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn('p-2 rounded-lg bg-muted', example.color)}>
                                    {example.icon}
                                </div>
                                <span className="text-sm font-medium">{example.action}</span>
                            </div>
                            <motion.span
                                className="text-sm font-mono text-muted-foreground"
                                animate={activeExample === index ? {
                                    scale: [1, 1.2, 1],
                                    color: ['var(--muted-foreground)', 'var(--primary)', 'var(--muted-foreground)']
                                } : {}}
                                transition={{ duration: 0.3 }}
                            >
                                -{example.cost}
                            </motion.span>
                        </motion.div>
                    ))}
                </div>

                {/* Value proposition */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: phase === 'complete' ? 1 : 0, y: phase === 'complete' ? 0 : 10 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 rounded-lg bg-muted/50 border border-dashed"
                >
                    <p className="text-sm text-muted-foreground text-center">
                        💡 <strong>Tip:</strong> Viewing & browsing is always <span className="text-green-600 font-semibold">FREE</span> —
                        credits are only used for actions that generate value.
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}

export default AnimatedCreditMeter;
