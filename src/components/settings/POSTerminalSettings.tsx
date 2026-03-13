import { Card } from '@/components/ui/card';
import { Monitor } from 'lucide-react';

export function POSTerminalSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Monitor className="h-5 w-5" />
        POS Terminal Settings
      </h3>
      <p className="text-muted-foreground">
        Configure receipt printer, cash drawer, barcode scanner, and tax display settings per terminal.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Configure hardware peripherals for your POS terminals.
      </div>
    </Card>
  );
}
