/**
 * Glass Card Component
 * Frosted glass effect card with backdrop blur
 * Inspired by modern UI design systems
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  header?: React.ReactNode;
}

export function GlassCard({ children, className, title, header }: GlassCardProps) {
  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-xl border-border shadow-lg',
        className
      )}
    >
      {title && (
        <CardHeader>
          <CardTitle className="text-card-foreground">{title}</CardTitle>
        </CardHeader>
      )}
      {header && <CardHeader>{header}</CardHeader>}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

