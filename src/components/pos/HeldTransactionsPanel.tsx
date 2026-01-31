/**
 * HeldTransactionsPanel Component
 * 
 * Displays held/parked transactions with recall/delete options.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pause, Play, Trash2, Clock, ShoppingCart } from 'lucide-react';
import { HeldTransaction } from '@/hooks/usePOSHeldTransactions';
import { formatDistanceToNow } from 'date-fns';

interface HeldTransactionsPanelProps {
    transactions: HeldTransaction[];
    onRecall: (id: string) => void;
    onDelete: (id: string) => void;
    canHold: boolean;
}

export function HeldTransactionsPanel({
    transactions,
    onRecall,
    onDelete,
    canHold,
}: HeldTransactionsPanelProps) {
    if (transactions.length === 0) {
        return null;
    }

    return (
        <Card className="flex-shrink-0">
            <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Pause className="h-4 w-4" />
                    Held ({transactions.length})
                    {!canHold && (
                        <Badge variant="destructive" className="text-xs">Max</Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="max-h-40">
                    <div className="px-4 pb-3 space-y-2">
                        {transactions.map((tx) => {
                            const itemCount = tx.cart.reduce((sum, item) => sum + item.quantity, 0);
                            const total = tx.cart.reduce((sum, item) => sum + item.subtotal, 0);

                            return (
                                <div
                                    key={tx.id}
                                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-medium text-sm">
                                                {itemCount} items · ${total.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {formatDistanceToNow(new Date(tx.heldAt), { addSuffix: true })}
                                            {tx.customerName && ` · ${tx.customerName}`}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2"
                                        onClick={() => onRecall(tx.id)}
                                    >
                                        <Play className="h-3 w-3 mr-1" />
                                        Resume
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => onDelete(tx.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export default HeldTransactionsPanel;
