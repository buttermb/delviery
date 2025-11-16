import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ModernPageProps {
  title: string;
  description?: string;
  children: ReactNode;
  backButton?: boolean;
  backButtonText?: string;
  className?: string;
}

/**
 * ModernPage Template Component
 * Provides consistent layout for modern pages with optional back button
 * Works for both public pages and admin pages
 */
export function ModernPage({ 
  title, 
  description, 
  children, 
  backButton = false,
  backButtonText = "Back",
  className = ""
}: ModernPageProps) {
  const navigate = useNavigate();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        {backButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

/**
 * ModernCard Component
 * Wrapper for consistent card styling in modern pages
 */
export function ModernCard({ 
  title, 
  icon: Icon, 
  children,
  className = ""
}: { 
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="p-6 space-y-4">
        {title && (
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
            </div>
          </div>
        )}
        <div>{children}</div>
      </div>
    </Card>
  );
}

