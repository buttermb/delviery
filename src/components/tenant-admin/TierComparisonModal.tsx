/**
 * Tier Comparison Modal
 * 
 * Displays a side-by-side comparison of all 5 business tiers
 * allowing users to see what they get at each level.
 */

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import Minus from "lucide-react/dist/esm/icons/minus";
import { BUSINESS_TIER_PRESETS, type BusinessTier, getTierColor } from '@/lib/presets/businessTiers';
import { cn } from '@/lib/utils';

interface TierComparisonModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentTier: BusinessTier;
}

export function TierComparisonModal({ open, onOpenChange, currentTier }: TierComparisonModalProps) {
    const tiers: BusinessTier[] = ['street', 'trap', 'block', 'hood', 'empire'];

    // Key features to compare
    const comparisonFeatures = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'pos-system', label: 'POS System' },
        { id: 'inventory-dashboard', label: 'Inventory Management' },
        { id: 'team-management', label: 'Team Management' },
        { id: 'multi-location', label: 'Multi-Location' },
        { id: 'advanced-analytics', label: 'Advanced Analytics' },
        { id: 'wholesale-portal', label: 'Wholesale Portal' },
        { id: 'api-access', label: 'API Access' },
        { id: 'white-label', label: 'White Label' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Business Tier Comparison</DialogTitle>
                    <DialogDescription>
                        Scale your operations with the right set of tools for your growth stage.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="grid grid-cols-6 gap-4 min-w-[800px] pb-6">
                        {/* Feature Labels Column */}
                        <div className="pt-32 space-y-4">
                            <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Core Features</div>
                            {comparisonFeatures.map(f => (
                                <div key={f.id} className="h-8 flex items-center text-sm font-medium">
                                    {f.label}
                                </div>
                            ))}

                            <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mt-8 mb-4">Limits</div>
                            <div className="h-8 flex items-center text-sm font-medium">Locations</div>
                            <div className="h-8 flex items-center text-sm font-medium">Team Members</div>
                            <div className="h-8 flex items-center text-sm font-medium">Products</div>
                        </div>

                        {/* Tier Columns */}
                        {tiers.map(tier => {
                            const preset = BUSINESS_TIER_PRESETS[tier];
                            const isCurrent = currentTier === tier;

                            return (
                                <div key={tier} className={cn(
                                    "flex flex-col space-y-4 p-4 rounded-lg border",
                                    isCurrent ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-transparent hover:bg-muted/50"
                                )}>
                                    {/* Header */}
                                    <div className="text-center space-y-2 h-24">
                                        <div className="text-2xl">{preset.emoji}</div>
                                        <div className="font-bold">{preset.displayName}</div>
                                        <Badge variant="outline" className="text-xs">
                                            {preset.revenueRange}
                                        </Badge>
                                        {isCurrent && (
                                            <Badge className="w-full justify-center mt-1">Current</Badge>
                                        )}
                                    </div>

                                    {/* Features */}
                                    <div className="space-y-4 pt-2">
                                        {comparisonFeatures.map(f => {
                                            // Determine access based on subscription tier mapping
                                            // Enterprise tier has all features, Professional has most, Starter has basics
                                            const subscriptionTier = preset.subscriptionTier;
                                            const advancedFeatures = ['advanced-analytics', 'api-access', 'white-label', 'multi-location'];
                                            const proFeatures = ['team-management', 'wholesale-portal', ...advancedFeatures];
                                            
                                            let hasAccess = true;
                                            if (subscriptionTier === 'starter') {
                                                hasAccess = !proFeatures.includes(f.id);
                                            } else if (subscriptionTier === 'professional') {
                                                hasAccess = !advancedFeatures.includes(f.id) || f.id === 'multi-location';
                                            }
                                            // Enterprise has access to everything

                                            return (
                                                <div key={f.id} className="h-8 flex items-center justify-center">
                                                    {hasAccess ? (
                                                        <Check className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <Minus className="h-4 w-4 text-muted-foreground/30" />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Spacer for Limits Header */}
                                        <div className="h-6 mt-8"></div>

                                        {/* Limits */}
                                        <div className="h-8 flex items-center justify-center text-sm">
                                            {preset.limits.locations}
                                        </div>
                                        <div className="h-8 flex items-center justify-center text-sm">
                                            {preset.limits.users}
                                        </div>
                                        <div className="h-8 flex items-center justify-center text-sm">
                                            {preset.limits.products >= 10000 ? 'Unlimited' : preset.limits.products}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
