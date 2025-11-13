import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface AvailabilitySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvailabilitySettings({
  open,
  onOpenChange,
}: AvailabilitySettingsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Availability Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Availability settings coming soon.</p>
            <p className="text-sm mt-2">
              Configure business hours, time slots, and blocked dates.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] touch-manipulation"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

