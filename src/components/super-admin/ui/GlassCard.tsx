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
        'bg-background/80 backdrop-blur-xl border-white/10 shadow-lg',
        className
      )}
    >
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      {header && <CardHeader>{header}</CardHeader>}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

