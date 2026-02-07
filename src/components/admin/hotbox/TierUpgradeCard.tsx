/**
 * TierUpgradeCard - Real-time tier upgrade progress tracker
 * 
 * Shows progress towards the next tier with:
 * - Current tier status
 * - Progress bars for revenue, locations, employees
 * - Upgrade suggestions
 * - Manual tier override option
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  MapPin, 
  Users, 
  Crown,
  Settings,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import {
  BusinessTier,
  getTierPreset,
  getTierColor,
} from '@/lib/presets/businessTiers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TIER_ORDER: BusinessTier[] = ['street', 'trap', 'block', 'hood', 'empire'];
const TIER_LABELS: Record<BusinessTier, string> = {
  street: 'Street',
  trap: 'Trap',
  block: 'Block',
  hood: 'Hood',
  empire: 'Empire',
};

interface TierUpgradeCardProps {
  compact?: boolean;
}

export function TierUpgradeCard({ compact = false }: TierUpgradeCardProps) {
  const {
    tier,
    preset,
    metrics,
    nextTier,
    nextTierRequirements,
    qualifiesForUpgrade,
    tierOverride,
    setTier,
    recalculateTier,
    isSettingTier,
    isRecalculating,
    isLoading,
  } = useBusinessTier();
  
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<BusinessTier>(tier);

  // Show skeleton instead of null when loading or no metrics
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-lg" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p className="text-sm">Tier metrics will appear as you add data</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate progress percentages
  const revenueProgress = nextTierRequirements
    ? Math.min(100, (metrics.monthlyRevenue / nextTierRequirements.minRevenue) * 100)
    : 100;
  const locationsProgress = nextTierRequirements
    ? Math.min(100, (metrics.locations / nextTierRequirements.minLocations) * 100)
    : 100;
  const teamProgress = nextTierRequirements
    ? Math.min(100, (metrics.teamSize / nextTierRequirements.minTeam) * 100)
    : 100;

  // Overall progress (average of all three)
  const overallProgress = Math.round((revenueProgress + locationsProgress + teamProgress) / 3);

  // How close to next tier (for showing "almost there" state)
  const isAlmostThere = overallProgress >= 90 && !qualifiesForUpgrade;

  const handleSetTier = () => {
    setTier({ tier: selectedTier, override: true });
    setOverrideDialogOpen(false);
    toast.success(`Tier set to ${getTierPreset(selectedTier).displayName}`);
  };

  const handleAutoDetect = () => {
    recalculateTier();
    toast.success('Tier will be recalculated based on your metrics');
    setOverrideDialogOpen(false);
  };

  // Compact view for sidebar or smaller spaces
  if (compact) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{preset.displayName}</span>
          </div>
          {tierOverride && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Override
            </Badge>
          )}
        </div>
        
        {nextTier && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Next: {getTierPreset(nextTier).displayName}</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-1.5" />
            {isAlmostThere && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Almost there!
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full card view
  return (
    <Card className={cn(
      qualifiesForUpgrade && 'border-green-500/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
      isAlmostThere && !qualifiesForUpgrade && 'border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30',
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {qualifiesForUpgrade ? 'READY TO UPGRADE!' : 'TIER PROGRESS'}
          </CardTitle>
          <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tier Settings</DialogTitle>
                <DialogDescription>
                  Override your auto-detected tier or let the system detect based on your metrics.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Tier</label>
                  <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as BusinessTier)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIER_ORDER.map((t) => {
                        const p = getTierPreset(t);
                        return (
                          <SelectItem key={t} value={t}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{TIER_LABELS[t]}</span>
                              <span>{p.displayName}</span>
                              <span className="text-muted-foreground text-xs">({p.revenueRange})</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <p className="font-medium mb-1">Current Metrics:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Revenue: ${metrics.monthlyRevenue.toLocaleString()}/mo</li>
                    <li>Locations: {metrics.locations}</li>
                    <li>Team Size: {metrics.teamSize}</li>
                  </ul>
                </div>
                
                {tierOverride && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Lock className="h-4 w-4" />
                    Currently using manual override
                  </p>
                )}
              </div>
              
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleAutoDetect}
                  disabled={isRecalculating}
                  className="flex items-center gap-2"
                >
                  <Unlock className="h-4 w-4" />
                  Auto-Detect
                </Button>
                <Button 
                  onClick={handleSetTier}
                  disabled={isSettingTier}
                >
                  Set to {getTierPreset(selectedTier).displayName}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Tier Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              getTierColor(tier)
            )}>
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <div className="font-bold text-lg">{preset.displayName} Tier</div>
              <div className="text-sm text-muted-foreground">{preset.tagline}</div>
            </div>
          </div>
          {tierOverride && (
            <Badge variant="outline">
              <Lock className="h-3 w-3 mr-1" />
              Override
            </Badge>
          )}
        </div>

        {/* Progress to Next Tier */}
        {nextTier && nextTierRequirements && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress to {getTierPreset(nextTier).displayName}</span>
              <Badge variant={qualifiesForUpgrade ? 'default' : isAlmostThere ? 'secondary' : 'outline'}>
                {overallProgress}%
              </Badge>
            </div>

            {/* Revenue Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Monthly Revenue
                </span>
                <span>
                  ${metrics.monthlyRevenue.toLocaleString()} / ${nextTierRequirements.minRevenue.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={revenueProgress} 
                className={cn('h-2', revenueProgress >= 100 && 'bg-green-200 [&>div]:bg-green-500')} 
              />
            </div>

            {/* Locations Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Locations
                </span>
                <span>
                  {metrics.locations} / {nextTierRequirements.minLocations}
                </span>
              </div>
              <Progress 
                value={locationsProgress} 
                className={cn('h-2', locationsProgress >= 100 && 'bg-green-200 [&>div]:bg-green-500')} 
              />
            </div>

            {/* Team Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Team Size
                </span>
                <span>
                  {metrics.teamSize} / {nextTierRequirements.minTeam}
                </span>
              </div>
              <Progress 
                value={teamProgress} 
                className={cn('h-2', teamProgress >= 100 && 'bg-green-200 [&>div]:bg-green-500')} 
              />
            </div>

            {/* Upgrade Message */}
            {qualifiesForUpgrade && (
              <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    You qualify for {getTierPreset(nextTier).displayName}!
                  </span>
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    setTier({ tier: nextTier, override: false });
                    toast.success(`Upgraded to ${getTierPreset(nextTier).displayName}!`);
                  }}
                  disabled={isSettingTier}
                >
                  Upgrade Now
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {isAlmostThere && !qualifiesForUpgrade && (
              <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-700 dark:text-yellow-400">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">Almost there! Keep growing to unlock {getTierPreset(nextTier).displayName} features.</span>
              </div>
            )}
          </div>
        )}

        {/* Already at max tier */}
        {!nextTier && (
          <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-lg text-yellow-700 dark:text-yellow-400">
            <Crown className="h-5 w-5" />
            <span className="font-medium">You've reached the Empire tier - the highest level!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TierUpgradeCard;

