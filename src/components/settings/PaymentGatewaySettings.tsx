import { Card } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export function PaymentGatewaySettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Payment Gateway Configuration
      </h3>
      <p className="text-muted-foreground">
        Configure payment processors like Stripe and Square with test/live mode toggle.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Configure multiple payment gateways and toggle between test and live modes.
      </div>
    </Card>
  );
}
