/**
 * Page Header Component
 * Consistent page headers with title, description, back button, and actions
 */

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Icon - can be emoji string, ReactNode, or LucideIcon */
  icon?: ReactNode | LucideIcon;
  /** Action buttons on the right */
  actions?: ReactNode;
  /** Show back button */
  showBackButton?: boolean;
  /** Custom back button handler (defaults to navigate(-1)) */
  onBack?: () => void;
  /** Custom back button label */
  backLabel?: string;
  /** Additional className */
  className?: string;
  /** Compact mode with less padding */
  compact?: boolean;
}

// Helper to check if something is a LucideIcon (forwardRef component)
const isLucideIcon = (icon: unknown): icon is LucideIcon => {
  if (typeof icon === 'function') return true;
  // LucideIcon is a forwardRef, check for $$typeof and render
  if (icon && typeof icon === 'object' && '$$typeof' in icon && 'render' in icon) {
    return true;
  }
  return false;
};

export function PageHeader({
  title,
  description,
  icon,
  actions,
  showBackButton = false,
  onBack,
  backLabel,
  className,
  compact = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const renderIcon = () => {
    if (!icon) return null;
    
    if (isLucideIcon(icon)) {
      const IconComponent = icon;
      return <IconComponent className="h-8 w-8 text-primary" />;
    }
    
    // String (emoji) or ReactNode
    if (typeof icon === 'string') {
      return <span className="text-3xl">{icon}</span>;
    }
    
    return <div className="text-3xl">{icon}</div>;
  };

  return (
    <div className={cn(compact ? 'mb-4' : 'mb-6', className)}>
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel || 'Back'}
        </Button>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {renderIcon()}
          <div>
            <h1 className={cn(compact ? 'text-2xl' : 'text-3xl', 'font-bold')}>{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
