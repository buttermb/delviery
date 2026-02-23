/**
 * UpgradePathSection Component
 * 
 * Compelling side-by-side comparison of Free vs Paid plans
 * with animated checkmarks and shine effects.
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Check,
    X,
    Sparkles,
    Infinity as InfinityIcon,
    Zap,
    ArrowRight,
    Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

// ============================================================================
// Types
// ============================================================================

interface UpgradePathSectionProps {
    onContinueFree?: () => void;
    onUpgrade?: () => void;
    className?: string;
}

interface FeatureComparison {
    feature: string;
    free: boolean | string;
    paid: boolean | string;
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring' as const,
            damping: 25,
            stiffness: 400
        }
    }
};

const checkVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: {
            type: 'spring' as const,
            damping: 15,
            stiffness: 500,
            delay: 0.3
        }
    }
};

// ============================================================================
// Component
// ============================================================================

export function UpgradePathSection({
    onContinueFree,
    onUpgrade,
    className,
}: UpgradePathSectionProps) {
    const navigate = useNavigate();
    const { tenant } = useTenantAdminAuth();

    const features: FeatureComparison[] = [
        { feature: 'Monthly credits', free: '500', paid: 'Unlimited' },
        { feature: 'Daily menus', free: '1', paid: 'Unlimited' },
        { feature: 'Products', free: '25', paid: 'Unlimited' },
        { feature: 'Team members', free: '1', paid: 'Up to 25' },
        { feature: 'Locations', free: '1', paid: 'Up to 10' },
        { feature: 'Route optimization', free: false, paid: true },
        { feature: 'AI analytics', free: false, paid: true },
        { feature: 'Custom reports', free: false, paid: true },
        { feature: 'API access', free: false, paid: true },
        { feature: 'Priority support', free: false, paid: true },
    ];

    const handleUpgrade = () => {
        onUpgrade?.();
        if (tenant?.slug) {
            navigate(`/${tenant.slug}/select-plan`);
        } else {
            navigate('/select-plan');
        }
    };

    const FeatureValue = ({ value, isPaid }: { value: boolean | string; isPaid: boolean }) => {
        if (typeof value === 'string') {
            return (
                <span className={cn(
                    'font-medium',
                    isPaid && value === 'Unlimited' && 'text-primary'
                )}>
                    {value === 'Unlimited' && <InfinityIcon className="inline h-4 w-4 mr-1" />}
                    {value}
                </span>
            );
        }

        if (value) {
            return (
                <motion.div variants={checkVariants}>
                    <Check className="h-5 w-5 text-green-500" />
                </motion.div>
            );
        }

        return <X className="h-5 w-5 text-muted-foreground/40" />;
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn('space-y-6', className)}
        >
            {/* Header */}
            <div className="text-center space-y-2">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 mb-2">
                        <Crown className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                </motion.div>
                <h3 className="text-xl font-bold">Ready to grow?</h3>
                <p className="text-sm text-muted-foreground">
                    Upgrade anytime for unlimited access
                </p>
            </div>

            {/* Comparison Cards */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Free Tier Card */}
                <motion.div
                    variants={cardVariants}
                    className="relative p-6 rounded-xl border bg-card"
                >
                    <div className="space-y-4">
                        <div>
                            <Badge variant="secondary" className="mb-2">Current Plan</Badge>
                            <h4 className="text-lg font-semibold">Free</h4>
                            <p className="text-3xl font-bold">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            {features.slice(0, 5).map((f) => (
                                <div key={f.feature} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{f.feature}</span>
                                    <FeatureValue value={f.free} isPaid={false} />
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={onContinueFree}
                        >
                            Continue Free
                        </Button>
                    </div>
                </motion.div>

                {/* Paid Tier Card */}
                <motion.div
                    variants={cardVariants}
                    className="relative p-6 rounded-xl border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden"
                >
                    {/* Shine effect */}
                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: '200%', opacity: [0, 0.3, 0] }}
                        transition={{ duration: 2, delay: 1, repeat: Infinity, repeatDelay: 3 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                    />

                    {/* Popular badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="absolute -top-px -right-px"
                    >
                        <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 rounded-bl-lg rounded-tr-lg">
                            <Sparkles className="h-3 w-3 mr-1" />
                            POPULAR
                        </Badge>
                    </motion.div>

                    <div className="space-y-4 relative z-10">
                        <div>
                            <Badge variant="default" className="mb-2 bg-primary/20 text-primary border-primary/30">
                                Recommended
                            </Badge>
                            <h4 className="text-lg font-semibold">Starter</h4>
                            <p className="text-3xl font-bold">$79<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-primary/20">
                            {features.slice(0, 5).map((f) => (
                                <div key={f.feature} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{f.feature}</span>
                                    <FeatureValue value={f.paid} isPaid={true} />
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                            onClick={handleUpgrade}
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            Upgrade Now
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                            14-day money-back guarantee
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Additional benefits */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
                {[
                    { icon: <InfinityIcon className="h-4 w-4" />, label: 'Unlimited credits' },
                    { icon: <Zap className="h-4 w-4" />, label: 'AI features' },
                    { icon: <Crown className="h-4 w-4" />, label: 'Priority support' },
                    { icon: <Check className="h-4 w-4" />, label: 'No daily limits' },
                ].map((item, i) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.9 + i * 0.1 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm"
                    >
                        <div className="text-primary">{item.icon}</div>
                        <span className="text-muted-foreground text-xs">{item.label}</span>
                    </motion.div>
                ))}
            </motion.div>
        </motion.div>
    );
}

export default UpgradePathSection;
