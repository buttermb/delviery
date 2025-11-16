import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LowCartValueUpsellProps {
  currentTotal: number;
  targetAmount: number;
}

export default function LowCartValueUpsell({ currentTotal, targetAmount }: LowCartValueUpsellProps) {
  const navigate = useNavigate();
  const remaining = targetAmount - currentTotal;

  if (currentTotal >= targetAmount) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background mb-4 md:mb-6">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base md:text-lg mb-2">
              Add ${remaining.toFixed(2)} more to unlock rewards! 🎁
            </h3>
            <ul className="text-xs md:text-sm text-muted-foreground space-y-1 mb-3 md:mb-4">
              <li>✓ 10% off your first order</li>
              <li>✓ Free shipping</li>
              <li>✓ Faster checkout next time</li>
            </ul>
            <Button 
              onClick={() => navigate('/')}
              variant="default"
              size="sm"
              className="w-full md:w-auto"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Browse Menu
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
