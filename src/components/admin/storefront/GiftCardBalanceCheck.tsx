/**
 * GiftCardBalanceCheck Component
 * Quick balance lookup for gift cards by code
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';

interface BalanceResult {
  id: string;
  current_balance: number;
  status: string;
  is_valid: boolean;
  message: string;
}

interface GiftCardBalanceCheckProps {
  storeId: string;
}

export function GiftCardBalanceCheck({ storeId }: GiftCardBalanceCheckProps) {
  const [code, setCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkBalance = async () => {
    if (!code.trim()) return;

    setIsChecking(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>
      ) => Promise<{ data: BalanceResult[] | null; error: { message: string } | null }>)(
        'validate_marketplace_gift_card',
        { p_store_id: storeId, p_code: code.trim().toUpperCase() }
      );

      if (rpcError) throw new Error(rpcError.message);

      if (data && data.length > 0) {
        setResult(data[0]);
      } else {
        setError('No result returned');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Balance check failed', { error: message });
      setError(message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      checkBalance();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Balance Check
        </CardTitle>
        <CardDescription>
          Look up gift card balance by code
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="Enter gift card code..."
            aria-label="Gift card code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setResult(null);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className="font-mono"
          />
          <Button
            onClick={checkBalance}
            disabled={isChecking || !code.trim()}
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/30">
            {result.is_valid ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Available Balance</span>
                  <Badge variant="default" className="bg-green-600">Valid</Badge>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(result.current_balance)}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="destructive">
                    {result.status === 'depleted' ? 'Depleted' : result.status === 'disabled' ? 'Disabled' : 'Invalid'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.current_balance > 0 && (
                  <div className="text-lg font-medium text-muted-foreground">
                    Balance: {formatCurrency(result.current_balance)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg border border-destructive/50 bg-destructive/10">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
