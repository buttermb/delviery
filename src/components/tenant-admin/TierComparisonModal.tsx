import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TierComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
}

export function TierComparisonModal({ open, onOpenChange }: TierComparisonModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Plan Comparison</DialogTitle>
        </DialogHeader>
        <div className="text-center py-8 text-muted-foreground">
          Plan comparison details coming soon.
        </div>
      </DialogContent>
    </Dialog>
  );
}
