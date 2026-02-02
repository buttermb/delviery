/**
 * Health Score Tooltip
 * detailed breakdown of tenant health score with actionable insights
 */

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Activity from "lucide-react/dist/esm/icons/activity";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Ticket from "lucide-react/dist/esm/icons/ticket";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";

interface HealthReason {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    message: string;
}

interface HealthScoreTooltipProps {
    score: number;
    reasons?: HealthReason[];
    children: React.ReactNode;
}

export function HealthScoreTooltip({ score, reasons = [], children }: HealthScoreTooltipProps) {
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-success';
        if (s >= 50) return 'text-warning';
        return 'text-destructive';
    };

    const getScoreLabel = (s: number) => {
        if (s >= 80) return 'Healthy';
        if (s >= 50) return 'At Risk';
        return 'Critical';
    };

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className="cursor-help">
                        {children}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="w-80 p-4" side="right">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div>
                                <h4 className="font-semibold">Health Score</h4>
                                <p className={`text-sm font-medium ${getScoreColor(score)}`}>
                                    {score}/100 - {getScoreLabel(score)}
                                </p>
                            </div>
                            <Activity className={`h-5 w-5 ${getScoreColor(score)}`} />
                        </div>

                        <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase">Key Factors</h5>
                            {reasons.length > 0 ? (
                                reasons.map((reason, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                        {reason.impact === 'positive' ? (
                                            <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                                        ) : reason.impact === 'negative' ? (
                                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                        ) : (
                                            <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        )}
                                        <span>{reason.message}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No health data available</p>
                            )}
                        </div>

                        {score < 80 && (
                            <div className="pt-2 border-t">
                                <Button variant="outline" size="sm" className="w-full h-8">
                                    View Improvement Plan
                                </Button>
                            </div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
