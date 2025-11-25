/**
 * TierBadge Component
 * 
 * Displays the current business tier with appropriate styling
 */

import { Badge } from '@/components/ui/badge';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { cn } from '@/lib/utils';
import type { BusinessTier } from '@/lib/presets/businessTiers';

interface TierBadgeProps {
  tier?: BusinessTier;
  size?: 'sm' | 'md' | 'lg';
  showEmoji?: boolean;
  className?: string;
}

export function TierBadge({ 
  tier: propTier, 
  size = 'md', 
  showEmoji = true,
  className 
}: TierBadgeProps) {
  const { tier: hookTier, preset } = useBusinessTier();
  const tier = propTier || hookTier;
  
  const tierConfig = {
    street: { 
      emoji: '🛵', 
      name: 'Street', 
      bg: 'bg-gray-100 dark:bg-gray-800', 
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-300 dark:border-gray-600'
    },
    trap: { 
      emoji: '🏪', 
      name: 'Trap', 
      bg: 'bg-blue-100 dark:bg-blue-900/30', 
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-600'
    },
    block: { 
      emoji: '🏢', 
      name: 'Block', 
      bg: 'bg-purple-100 dark:bg-purple-900/30', 
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-300 dark:border-purple-600'
    },
    hood: { 
      emoji: '🏙️', 
      name: 'Hood', 
      bg: 'bg-orange-100 dark:bg-orange-900/30', 
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-300 dark:border-orange-600'
    },
    empire: { 
      emoji: '👑', 
      name: 'Empire', 
      bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-300 dark:border-yellow-600'
    },
  };

  const config = tierConfig[tier] || tierConfig.street;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge 
      variant="outline"
      className={cn(
        config.bg,
        config.text,
        config.border,
        sizeClasses[size],
        'font-medium',
        className
      )}
    >
      {showEmoji && <span className="mr-1">{config.emoji}</span>}
      {config.name}
    </Badge>
  );
}

