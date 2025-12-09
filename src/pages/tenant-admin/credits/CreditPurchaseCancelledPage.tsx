import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { useTenantNavigation } from '@/hooks/useTenantNavigation';
import { useCredits } from '@/contexts/CreditContext';

export default function CreditPurchaseCancelledPage() {
  const { navigateToAdmin } = useTenantNavigation();
  const { setIsPurchaseModalOpen } = useCredits();

  const handleTryAgain = () => {
    setIsPurchaseModalOpen(true);
    navigateToAdmin('dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Purchase Cancelled</CardTitle>
          <CardDescription>
            Your credit purchase was not completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            No charges were made to your account. You can try again anytime.
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={handleTryAgain} className="w-full">
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigateToAdmin('dashboard')} 
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
