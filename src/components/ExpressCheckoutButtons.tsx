import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExpressCheckoutButtonsProps {
  onCheckout?: () => void;
}

const ExpressCheckoutButtons = ({ onCheckout }: ExpressCheckoutButtonsProps) => {
  return (
    <div className="space-y-4">
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                disabled
                className="h-12 border-2 font-semibold opacity-50 cursor-not-allowed"
              >
                <span className="text-lg mr-2">🍎</span>
                Apple Pay
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Apple Pay coming Q1 2025</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                disabled
                className="h-12 border-2 font-semibold opacity-50 cursor-not-allowed"
              >
                <span className="text-lg mr-2">G</span>
                Google Pay
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Google Pay coming Q1 2025</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      
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
