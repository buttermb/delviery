import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutReminderBannerProps {
  savings: number;
  onSignUpClick: () => void;
}

export default function CheckoutReminderBanner({ savings, onSignUpClick }: CheckoutReminderBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn(
      "relative bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10",
      "border border-primary/20 rounded-xl p-4 mb-4 md:mb-6",
      "animate-fade-in"
    )}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-center gap-3 pr-8">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">
            💡 You could save <span className="text-primary font-bold">${savings.toFixed(2)}</span> right now!
          </p>
          <p className="text-xs text-muted-foreground">
            Sign up for 10% off + free shipping on this order
          </p>
        </div>
        <Button 
          onClick={onSignUpClick}
          variant="default"
          size="sm"
          className="hidden md:flex"
        >
          Quick Sign Up
        </Button>
      </div>
      <Button 
        onClick={onSignUpClick}
        variant="default"
        size="sm"
        className="w-full mt-3 md:hidden"
      >
        Quick Sign Up
      </Button>
    </div>
  );
}
