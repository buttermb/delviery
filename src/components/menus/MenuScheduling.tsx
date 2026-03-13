import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

interface MenuSchedulingProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function MenuScheduling({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: MenuSchedulingProps) {
  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Menu Scheduling
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="datetime-local"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="datetime-local"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}
