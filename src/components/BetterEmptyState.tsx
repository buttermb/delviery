/**
 * BetterEmptyState - Backward Compatible Wrapper
 * 
 * @deprecated Use EnhancedEmptyState from '@/components/shared/EnhancedEmptyState' directly
 * This file is maintained for backward compatibility only.
 */

import type { LucideIcon } from "lucide-react";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";

interface BetterEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function BetterEmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: BetterEmptyStateProps) {
  return (
    <EnhancedEmptyState
      type="generic"
      icon={icon}
      title={title}
      description={description}
      primaryAction={action ? {
        label: action.label,
        onClick: action.onClick,
        icon: action.icon,
      } : undefined}
      secondaryAction={secondaryAction}
      className={className}
      compact
    />
  );
}
