import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock } from 'lucide-react';

interface WholesaleDeliverySchedulingProps {
  deliveryDate: string;
  deliveryWindow: string;
  onDeliveryDateChange: (date: string) => void;
  onDeliveryWindowChange: (window: string) => void;
}

export function WholesaleDeliveryScheduling({
  deliveryDate,
  deliveryWindow,
  onDeliveryDateChange,
  onDeliveryWindowChange,
}: WholesaleDeliverySchedulingProps) {
  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Delivery Scheduling
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Delivery Date</Label>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => onDeliveryDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Time Window</Label>
          <Select value={deliveryWindow} onValueChange={onDeliveryWindowChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning (8AM-12PM)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12PM-4PM)</SelectItem>
              <SelectItem value="evening">Evening (4PM-8PM)</SelectItem>
              <SelectItem value="flexible">Flexible</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
