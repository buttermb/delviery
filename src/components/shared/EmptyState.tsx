/**
 * Reusable Empty State Component
 * Shows helpful empty states with CTAs
 */

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "default" | "outline" | "ghost";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "default",
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <Icon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
      <h3 className="text-xl font-semibold mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant={actionVariant}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
