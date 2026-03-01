/**
 * GiftCardLedger Component
 * Shows the transaction history (redemptions, adjustments, refunds) for a single gift card
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Loader2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';

interface LedgerEntry {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: 'issue' | 'use' | 'adjustment' | 'refund' | 'reload';
  order_id: string | null;
  note: string | null;
  created_at: string;
}

interface GiftCardInfo {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  status: string;
  recipient_email: string | null;
  recipient_name: string | null;
}

interface GiftCardLedgerProps {
  storeId: string;
  card: GiftCardInfo;
  onBack: () => void;
}

export function GiftCardLedger({ storeId, card, onBack }: GiftCardLedgerProps) {
  const { data: ledgerEntries = [], isLoading } = useQuery({
    queryKey: queryKeys.giftCards.ledger(card.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_gift_card_ledger')
        .select('id, amount, balance_after, transaction_type, order_id, note, created_at')
        .eq('gift_card_id', card.id)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    enabled: !!card.id && !!storeId,
  });

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'issue':
        return <Badge variant="default" className="bg-blue-600">Issued</Badge>;
      case 'use':
        return <Badge variant="secondary">Redeemed</Badge>;
      case 'refund':
        return <Badge variant="default" className="bg-green-600">Refund</Badge>;
      case 'reload':
        return <Badge variant="default" className="bg-purple-600">Reload</Badge>;
      case 'adjustment':
        return <Badge variant="outline">Adjustment</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getAmountDisplay = (entry: LedgerEntry) => {
    const isPositive = entry.amount > 0;
    return (
      <span className={isPositive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
        {isPositive ? '+' : ''}{formatCurrency(entry.amount)}
      </span>
    );
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'use':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'refund':
      case 'reload':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to gift cards">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>
              Card: <code className="font-mono font-bold">{card.code}</code>
              {card.recipient_email && <> • {card.recipient_email}</>}
              {' • '}Balance: {formatCurrency(card.current_balance)} / {formatCurrency(card.initial_balance)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No transactions found</p>
            <p className="text-sm">This card has no recorded transactions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{getTransactionIcon(entry.transaction_type)}</TableCell>
                    <TableCell>{getTransactionBadge(entry.transaction_type)}</TableCell>
                    <TableCell className="text-right">{getAmountDisplay(entry)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.balance_after)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {entry.note || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatSmartDate(entry.created_at, { includeTime: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
