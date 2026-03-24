/**
 * AnimatedCreditMeter Component
 * 
 * A clean, professional meter that shows the FREE tier credit allocation.
 * Features subtle entry animations and clear credit examples.
 */

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Coins, Sparkles, Zap, MessageSquare, ShoppingCart, FileText } from 'lucide-react';
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

        // Phase 2: Start examples shortly after
        const examplesTimeout = setTimeout(() => {
            setPhase('examples');
        }, 1200);

        // Phase 3: Show examples with stagger
        const exampleTimeouts: ReturnType<typeof setTimeout>[] = [];
        creditExamples.forEach((_, index) => {
            exampleTimeouts.push(
                setTimeout(() => {
                    setActiveExample(index);
                }, 1500 + index * 400)
            );
        });

        // Phase 4: Complete
        const completeTimeout = setTimeout(() => {
            setPhase('complete');
            onAnimationComplete?.();
        }, 1500 + creditExamples.length * 400 + 400);

        return () => {
            clearTimeout(fillTimeout);
            clearTimeout(examplesTimeout);
            exampleTimeouts.forEach(clearTimeout);
            clearTimeout(completeTimeout);
        };
    }, [autoPlay, creditValue, onAnimationComplete]);

    return (
        <div className={cn('space-y-6', className)}>
            {/* Main Credit Display */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative"
            >
                {/* Credit card */}
                <div className="bg-card border shadow-sm rounded-xl p-6 overflow-hidden">
                    {/* Content */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                            <Coins className="h-4 w-4" />
                            <span className="text-sm font-medium">Your Starting Balance</span>
                        </div>

                        {/* Animated counter */}
                        <div className="text-4xl font-semibold tracking-tight mb-4 flex items-baseline gap-1">
                            {displayValue.toLocaleString()}
                            <span className="text-lg text-muted-foreground font-normal">credits</span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                            <motion.div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${progressValue}%` }}
                            />
                        </div>

                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
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
                className="space-y-4"
            >
                <p className="text-sm font-medium">
                    Example credit usage
                </p>

                <div className="grid gap-2">
                    {creditExamples.map((example, index) => (
                        <motion.div
                            key={example.action}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{
                                opacity: activeExample >= index ? 1 : 0.4,
                                x: activeExample >= index ? 0 : -10,
                            }}
                            transition={{
                                duration: 0.3,
                                delay: index * 0.05
                            }}
                            className={cn(
                                'flex items-center justify-between p-3 rounded-lg border bg-card transition-colors',
                                activeExample === index && 'border-primary shadow-sm ring-1 ring-primary/20'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn('p-2 rounded-md bg-muted', example.color)}>
                                    {example.icon}
                                </div>
                                <span className="text-sm font-medium">{example.action}</span>
                            </div>
                            <span className="text-sm font-mono font-medium text-muted-foreground">
                                -{example.cost}
                            </span>
                        </motion.div>
                    ))}
                </div>

                {/* Value proposition */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: phase === 'complete' ? 1 : 0 }}
                    transition={{ duration: 0.4 }}
                    className="p-3 text-sm text-muted-foreground flex gap-2 items-start bg-muted/30 rounded-lg"
                >
                    <span className="text-primary mt-0.5">💡</span>
                    <p>
                        <strong>Tip:</strong> Viewing & browsing is always free. Credits are only used for actions that generate value.
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}

export default AnimatedCreditMeter;

