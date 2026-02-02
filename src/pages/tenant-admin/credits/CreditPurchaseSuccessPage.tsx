import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Coins from "lucide-react/dist/esm/icons/coins";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useCredits } from '@/hooks/useCredits';
import { useTenantNavigation } from '@/hooks/useTenantNavigation';
import { useQueryClient } from '@tanstack/react-query';

export default function CreditPurchaseSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { balance: credits, isLoading } = useCredits();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();
  const [hasRefreshed, setHasRefreshed] = useState(false);

  // Refresh credits on mount
  useEffect(() => {
    if (!hasRefreshed) {
      queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });
      setHasRefreshed(true);
    }
  }, [queryClient, hasRefreshed]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Purchase Successful!</CardTitle>
          <CardDescription>
            Your credits have been added to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Coins className="w-5 h-5" />
              <span className="text-sm">Current Balance</span>
            </div>
            <div className="text-3xl font-bold">
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                credits.toLocaleString()
              )}
            </div>
            <div className="text-sm text-muted-foreground">credits</div>
          </div>

          {sessionId && (
            <p className="text-xs text-muted-foreground">
              Transaction ID: {sessionId.slice(0, 20)}...
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigateToAdmin('dashboard')} className="w-full">
              Go to Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigateToAdmin('billing')} 
              className="w-full"
            >
              View Billing History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
