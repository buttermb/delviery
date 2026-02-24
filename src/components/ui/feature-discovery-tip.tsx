import React, { useState, useEffect } from 'react';
import { X, Lightbulb, Sparkles, Keyboard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface FeatureTip {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  learnMoreUrl?: string;
}

interface FeatureDiscoveryTipProps {
  tip: FeatureTip;
  /** Variant style */
  variant?: 'inline' | 'floating' | 'banner';
  /** Position for floating variant */
  position?: 'top-right' | 'bottom-right' | 'bottom-left';
  /** Whether to show the tip */
  show?: boolean;
  /** Called when tip is dismissed */
  onDismiss?: () => void;
  /** Called when "Don't show again" is clicked */
  onNeverShowAgain?: () => void;
  /** Additional class names */
  className?: string;
}

const DISMISSED_TIPS_KEY = STORAGE_KEYS.DISMISSED_FEATURE_TIPS;

function getDismissedTips(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_TIPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function dismissTip(tipId: string) {
  const dismissed = getDismissedTips();
  if (!dismissed.includes(tipId)) {
    dismissed.push(tipId);
    localStorage.setItem(DISMISSED_TIPS_KEY, JSON.stringify(dismissed));
  }
}

export function useFeatureTip(tipId: string) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = getDismissedTips();
    setIsDismissed(dismissed.includes(tipId));
  }, [tipId]);

  const dismiss = () => {
    dismissTip(tipId);
    setIsDismissed(true);
  };

  return { isDismissed, dismiss };
}

export function FeatureDiscoveryTip({
  tip,
  variant = 'inline',
  position = 'bottom-right',
  show = true,
  onDismiss,
  onNeverShowAgain,
  className,
}: FeatureDiscoveryTipProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleNeverShowAgain = () => {
    dismissTip(tip.id);
    setIsVisible(false);
    onNeverShowAgain?.();
  };

  if (!isVisible) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
          {tip.icon || <Lightbulb className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">{tip.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{tip.description}</p>
          <div className="mt-2 flex items-center gap-2">
            {tip.actionLabel && tip.onAction && (
              <Button size="sm" variant="default" onClick={tip.onAction}>
                {tip.actionLabel}
              </Button>
            )}
            {tip.learnMoreUrl && (
              <a
                href={tip.learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Learn more →
              </a>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-6 sm:w-6 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="mt-2 pt-2 border-t border-border flex justify-end">
        <button
          onClick={handleNeverShowAgain}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Don't show again
        </button>
      </div>
    </>
  );

  if (variant === 'floating') {
    return (
      <div
        className={cn(
          'fixed z-50 w-80 p-4 bg-popover border border-border rounded-lg shadow-lg animate-in slide-in-from-bottom-2',
          positionClasses[position],
          className
        )}
      >
        {content}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'w-full p-3 bg-primary/5 border border-primary/20 rounded-lg',
          className
        )}
      >
        {content}
      </div>
    );
  }

  // Inline variant
  return (
    <div
      className={cn(
        'p-3 bg-muted/50 border border-border rounded-lg',
        className
      )}
    >
      {content}
    </div>
  );
}

/**
 * Predefined feature tips
 */
export const featureTips: Record<string, FeatureTip> = {
  commandPalette: {
    id: 'command_palette',
    title: 'Quick Navigation',
    description: 'Press Cmd+K (or Ctrl+K) to open the command palette and quickly search or navigate anywhere.',
    icon: <Keyboard className="h-4 w-4" />,
    actionLabel: 'Try It',
  },
  keyboardShortcuts: {
    id: 'keyboard_shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Use keyboard shortcuts to work faster. Press ? to see all available shortcuts.',
    icon: <Zap className="h-4 w-4" />,
  },
  bulkActions: {
    id: 'bulk_actions',
    title: 'Bulk Actions',
    description: 'Select multiple items to perform bulk actions like status updates, exports, or deletions.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  inlineEditing: {
    id: 'inline_editing',
    title: 'Quick Editing',
    description: 'Click on stock or price values directly in the table to edit them without opening the full form.',
    icon: <Lightbulb className="h-4 w-4" />,
  },
  savedFilters: {
    id: 'saved_filters',
    title: 'Save Your Filters',
    description: 'Save frequently used filter combinations for one-click access later.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  autoNotifications: {
    id: 'auto_notifications',
    title: 'Automatic Notifications',
    description: 'Set up automatic notifications to customers when orders ship or status changes.',
    icon: <Lightbulb className="h-4 w-4" />,
  },
};

interface FeatureTipManagerProps {
  /** Which tips to potentially show */
  eligibleTips: (keyof typeof featureTips)[];
  /** Delay before showing tip (ms) */
  delay?: number;
  /** Variant for tips */
  variant?: 'inline' | 'floating' | 'banner';
}

export function FeatureTipManager({
  eligibleTips,
  delay = 5000,
  variant = 'floating',
}: FeatureTipManagerProps) {
  const [activeTip, setActiveTip] = useState<FeatureTip | null>(null);

  useEffect(() => {
    const dismissed = getDismissedTips();
    const undismissedTips = eligibleTips
      .map((key) => featureTips[key])
      .filter((tip) => tip && !dismissed.includes(tip.id));

    if (undismissedTips.length > 0) {
      const timer = setTimeout(() => {
        // Show a random undismissed tip
        const randomTip = undismissedTips[Math.floor(Math.random() * undismissedTips.length)];
        setActiveTip(randomTip);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [eligibleTips, delay]);

  if (!activeTip) return null;

  return (
    <FeatureDiscoveryTip
      tip={activeTip}
      variant={variant}
      onDismiss={() => setActiveTip(null)}
      onNeverShowAgain={() => setActiveTip(null)}
    />
  );
}
