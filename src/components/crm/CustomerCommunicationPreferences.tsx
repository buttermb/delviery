import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/** Task 324: Customer communication preferences */
export function CustomerCommunicationPreferences({ customerId }: { customerId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Preferences</CardTitle>
        <CardDescription>Email, SMS, and contact method preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="email-opt-in" />
          <Label htmlFor="email-opt-in">Email notifications</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="sms-opt-in" />
          <Label htmlFor="sms-opt-in">SMS notifications</Label>
        </div>
      </CardContent>
    </Card>
  );
}
