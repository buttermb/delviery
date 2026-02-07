/**
 * EmptyState - Backward Compatible Wrapper
 * 
 * @deprecated Use EnhancedEmptyState from '@/components/shared/EnhancedEmptyState' directly
 * This file is maintained for backward compatibility only.
 */

import { LucideIcon } from "lucide-react";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "default" | "outline" | "ghost";
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "default",
}: EmptyStateProps) {
  return (
    <EnhancedEmptyState
      type="generic"
      icon={icon}
      title={title}
      description={description}
      primaryAction={actionLabel && onAction ? {
        label: actionLabel,
        onClick: onAction,
      } : undefined}
      compact
    />
  );
}
