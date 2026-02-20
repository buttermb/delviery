import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, X } from "lucide-react";
import { useState } from "react";
import { showSuccessToast } from "@/lib/toastUtils";
import { formatSmartDate } from "@/lib/formatters";

interface AvailabilitySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BusinessHours {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT_HOURS: BusinessHours[] = [
  { day: "Monday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Tuesday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Wednesday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Thursday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Friday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Saturday", enabled: false, start: "10:00", end: "14:00" },
  { day: "Sunday", enabled: false, start: "10:00", end: "14:00" },
];

export function AvailabilitySettings({
  open,
  onOpenChange,
}: AvailabilitySettingsProps) {
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>(DEFAULT_HOURS);
  const [slotDuration, setSlotDuration] = useState(30);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");

  const handleSave = () => {
    showSuccessToast("Availability settings saved");
    onOpenChange(false);
  };

  const updateHours = (index: number, field: keyof BusinessHours, value: string | boolean) => {
    const updated = [...businessHours];
    updated[index] = { ...updated[index], [field]: value };
    setBusinessHours(updated);
  };

  const addBlockedDate = () => {
    if (newBlockedDate && !blockedDates.includes(newBlockedDate)) {
      setBlockedDates([...blockedDates, newBlockedDate]);
      setNewBlockedDate("");
    }
  };

  const removeBlockedDate = (date: string) => {
    setBlockedDates(blockedDates.filter(d => d !== date));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Availability Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Business Hours */}
          <div className="space-y-3">
            <h3 className="font-medium">Business Hours</h3>
            {businessHours.map((hours, index) => (
              <Card key={hours.day} className="p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={hours.enabled}
                    onCheckedChange={(checked) => updateHours(index, "enabled", checked)}
                  />
                  <span className="w-24 font-medium">{hours.day}</span>
                  {hours.enabled && (
                    <>
                      <Input
                        type="time"
                        value={hours.start}
                        onChange={(e) => updateHours(index, "start", e.target.value)}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={hours.end}
                        onChange={(e) => updateHours(index, "end", e.target.value)}
                        className="w-32"
                      />
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Slot Duration */}
          <div className="space-y-2">
            <Label htmlFor="slot_duration">Appointment Slot Duration (minutes)</Label>
            <Input
              id="slot_duration"
              type="number"
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              min={15}
              max={120}
              step={15}
            />
            <p className="text-xs text-muted-foreground">
              Time intervals for appointment bookings (15, 30, 45, or 60 minutes)
            </p>
          </div>

          {/* Blocked Dates */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Blocked Dates
            </h3>
            <div className="flex gap-2">
              <Input
                type="date"
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <Button onClick={addBlockedDate} variant="outline">
                Add
              </Button>
            </div>
            {blockedDates.length > 0 && (
              <div className="space-y-2">
                {blockedDates.map((date) => (
                  <Card key={date} className="p-2 flex items-center justify-between">
                    <span className="text-sm">
                      {formatSmartDate(date)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBlockedDate(date)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="min-h-[44px] touch-manipulation"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
