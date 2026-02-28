import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, X } from 'lucide-react';
import {
  FEATURES,
  TIER_NAMES,
  TIER_PRICES,
  type SubscriptionTier,
} from '@/lib/featureConfig';
import { type BusinessTier } from '@/lib/presets/businessTiers';
import { businessTierToSubscriptionTier } from '@/lib/tierMapping';

interface TierComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: BusinessTier;
}

const TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];

export function TierComparisonModal({ open, onOpenChange, currentTier }: TierComparisonModalProps) {
  const currentSubscriptionTier = businessTierToSubscriptionTier(currentTier);
  const featureEntries = Object.entries(FEATURES);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Plans</DialogTitle>
          <DialogDescription>See what each plan includes</DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 pr-4 font-medium">Feature</th>
                {TIERS.map((tier) => (
                  <th key={tier} className="text-center py-3 px-4 font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <span>{TIER_NAMES[tier]}</span>
                      <span className="text-muted-foreground font-normal">${TIER_PRICES[tier]}/mo</span>
                      {tier === currentSubscriptionTier && (
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureEntries.map(([, feature]) => (
                <tr key={feature.name} className="border-b">
                  <td className="py-2 pr-4">{feature.name}</td>
                  {TIERS.map((tier) => {
                    const tierIndex = TIERS.indexOf(tier);
                    const requiredIndex = TIERS.indexOf(feature.tier);
                    const included = tierIndex >= requiredIndex;
                    return (
                      <td key={tier} className="text-center py-2 px-4">
                        {included ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
