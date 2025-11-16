import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Gift, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface PostPurchaseSignupPromptProps {
  orderEmail: string;
  orderNumber: string;
}

export default function PostPurchaseSignupPrompt({ orderEmail, orderNumber }: PostPurchaseSignupPromptProps) {
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleCreateAccount = async () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsCreating(true);
    // This would integrate with your auth system
    toast.success('Account created! You can now track your orders.');
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2">Track Your Order Anytime!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an account to track order <span className="font-semibold text-foreground">{orderNumber}</span> and get 10% off your next purchase.
            </p>
            
            <div className="space-y-3 mb-4 bg-muted/50 p-3 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Track deliveries in real-time</span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />
                <span>10% off your next order</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>Faster checkout next time</span>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Create a password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                autoComplete="new-password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password.length >= 6) {
                    handleCreateAccount();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleCreateAccount}
                  disabled={password.length < 6 || isCreating}
                  variant="default"
                  className="flex-1"
                >
                  Create Account & Get 10% Off
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setDismissed(true)}
                  className="text-sm"
                >
                  Maybe Later
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              We'll use {orderEmail} for your account
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
