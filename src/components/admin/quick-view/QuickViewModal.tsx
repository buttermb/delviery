/**
 * QuickViewModal - Base wrapper for quick-view dialogs
 * Provides consistent layout with header, content area, and footer with "View Full Details" button
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import { cn } from '@/lib/utils';

interface QuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onViewFullDetails?: () => void;
  viewFullDetailsLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function QuickViewModal({
  open,
  onOpenChange,
  title,
  description,
  onViewFullDetails,
  viewFullDetailsLabel = 'View Full Details',
  children,
  className,
}: QuickViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[480px]', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {children}
        </div>

        {onViewFullDetails && (
          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onViewFullDetails();
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {viewFullDetailsLabel}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
