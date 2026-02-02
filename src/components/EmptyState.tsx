/**
 * EmptyState - Backward Compatible Wrapper
 * 
 * @deprecated Use EnhancedEmptyState from '@/components/shared/EnhancedEmptyState' directly
 * This file is maintained for backward compatibility only.
 */

import LucideIcon from "lucide-react/dist/esm/icons/lucide-icon";
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <EnhancedEmptyState
      type="generic"
      icon={icon}
      title={title}
      description={description}
      primaryAction={action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined}
      compact
    />
  );
}
