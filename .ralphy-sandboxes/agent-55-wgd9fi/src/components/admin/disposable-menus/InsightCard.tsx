
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface InsightCardProps {
    type: 'opportunity' | 'risk' | 'trend' | 'anomaly';
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    metric?: string;
}

export function InsightCard({ type, title, description, actionLabel, onAction, metric }: InsightCardProps) {
    const getIcon = () => {
        switch (type) {
            case 'opportunity': return <Sparkles className="h-5 w-5 text-yellow-400" />;
            case 'risk': return <AlertTriangle className="h-5 w-5 text-red-400" />;
            case 'trend': return <TrendingUp className="h-5 w-5 text-green-400" />;
            default: return <Sparkles className="h-5 w-5 text-blue-400" />;
        }
    };

    const getGradient = () => {
        switch (type) {
            case 'opportunity': return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20';
            case 'risk': return 'from-red-500/10 to-pink-500/10 border-red-500/20';
            case 'trend': return 'from-green-500/10 to-emerald-500/10 border-green-500/20';
            default: return 'from-blue-500/10 to-indigo-500/10 border-blue-500/20';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className="h-full"
        >
            <Card className={`h-full p-6 backdrop-blur-xl bg-gradient-to-br ${getGradient()} border shadow-lg relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    {getIcon()}
                </div>

                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-background/40 backdrop-blur-md border border-white/10">
                        {getIcon()}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
                            {metric && (
                                <span className="text-sm font-mono font-medium bg-background/30 px-2 py-1 rounded">
                                    {metric}
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            {description}
                        </p>
                        {actionLabel && (
                            <Button
                                onClick={onAction}
                                variant="ghost"
                                className="group p-0 h-auto hover:bg-transparent hover:text-primary"
                            >
                                {actionLabel}
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}
