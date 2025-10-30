import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface ExpressCheckoutButtonsProps {
  onCheckout?: () => void;
}

const ExpressCheckoutButtons = ({ onCheckout }: ExpressCheckoutButtonsProps) => {
  const handleApplePay = () => {
    // Check if Apple Pay is available
    const applePaySession = (window as any).ApplePaySession;
    if (applePaySession?.canMakePayments?.()) {
      toast.info("Apple Pay integration coming soon!");
      // In production, this would trigger Apple Pay flow
    } else {
      toast.error("Apple Pay is not available on this device");
    }
  };

  const handleGooglePay = () => {
    toast.info("Google Pay integration coming soon!");
    // In production, this would trigger Google Pay flow
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={handleApplePay}
          className="h-12 border-2 font-semibold hover:scale-105 transition-transform"
        >
          <span className="text-lg mr-2">🍎</span>
          Apple Pay
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleGooglePay}
          className="h-12 border-2 font-semibold hover:scale-105 transition-transform"
        >
          <span className="text-lg mr-2">G</span>
          Google Pay
        </Button>
      </div>
      
      <div className="relative">
        <Separator />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
            or pay with card
          </span>
        </div>
      </div>
    </div>
  );
};

export default ExpressCheckoutButtons;
