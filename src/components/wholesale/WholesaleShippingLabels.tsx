import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Truck, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface ShippingLabelProps {
  orderId: string;
  clientName: string;
  address: string;
}

export function WholesaleShippingLabels({ orderId, clientName, address }: ShippingLabelProps) {
  const handlePrint = () => {
    window.print();
    toast.success('Printing shipping label');
  };

  return (
    <Card className="p-4 print:p-8">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h4 className="font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Shipping Label
        </h4>
        <Button onClick={handlePrint} size="sm" variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="border-2 border-black p-6 space-y-4 print:border-4">
        <div>
          <Label className="text-xs text-muted-foreground">Order ID</Label>
          <div className="font-mono font-bold text-2xl">{orderId}</div>
        </div>

        <div className="border-t pt-4">
          <Label className="text-xs text-muted-foreground">SHIP TO</Label>
          <div className="font-bold text-lg mt-1">{clientName}</div>
          <div className="text-sm mt-2 whitespace-pre-line">{address}</div>
        </div>

        <div className="border-t pt-4">
          <Label className="text-xs text-muted-foreground">Tracking</Label>
          <div className="font-mono text-sm">TRACK-{orderId.slice(0, 8).toUpperCase()}</div>
        </div>
      </div>
    </Card>
  );
}
