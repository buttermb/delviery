import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
    Gift,
    Plus,
    Search,
    Loader2,
    Copy,
    Mail,
    RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface GiftCard {
    id: string;
    code: string;
    initial_balance: number;
    current_balance: number;
    status: 'active' | 'disabled' | 'depleted';
    recipient_email: string | null;
    created_at: string;
}

interface GiftCardManagerProps {
    storeId: string;
}

export function StorefrontGiftCardManager({ storeId }: GiftCardManagerProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [issueForm, setIssueForm] = useState({
        initial_balance: '',
        recipient_email: '',
        recipient_name: '',
        notes: '',
        custom_code: '',
    });

    // Fetch Gift Cards
    const { data: giftCards = [], isLoading } = useQuery({
        queryKey: ['gift-cards', storeId],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from as any)('marketplace_gift_cards')
                .select('*')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as GiftCard[];
        },
        enabled: !!storeId,
    });

    // Validated Mutation that uses RPC
    const issueCardMutation = useMutation({
        mutationFn: async (data: typeof issueForm) => {
            const { data: cardId, error } = await (supabase.rpc as any)('issue_marketplace_gift_card', {
                p_store_id: storeId,
                p_initial_balance: Number(data.initial_balance),
                p_code: data.custom_code || null,
                p_recipient_email: data.recipient_email || null,
                p_recipient_name: data.recipient_name || null,
                p_notes: data.notes || null,
            });

            if (error) throw error;
            return cardId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gift-cards', storeId] });
            toast({ title: 'Gift Card Issued Successfully' });
            setIsIssueDialogOpen(false);
            setIssueForm({ initial_balance: '', recipient_email: '', recipient_name: '', notes: '', custom_code: '' });
        },
        onError: (err) => {
            toast({
                title: 'Error issuing card',
                description: err.message,
                variant: 'destructive',
            });
        },
    });

    const filteredCards = giftCards.filter(card =>
        card.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.recipient_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast({ title: 'Code copied!' });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5" />
                            Gift Cards
                        </CardTitle>
                        <CardDescription>
                            Issue and manage digital gift cards
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsIssueDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Issue Card
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by code or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredCards.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">No gift cards found</p>
                        <p className="text-sm">Issue your first gift card to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredCards.map(card => (
                            <div
                                key={card.id}
                                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/5 transition-colors"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded font-bold">
                                            {card.code}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={() => copyCode(card.code)}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        {card.recipient_email ? (
                                            <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> {card.recipient_email}
                                            </span>
                                        ) : (
                                            <span>No Recipient</span>
                                        )}
                                        <span>•</span>
                                        <span>Issued {formatSmartDate(card.created_at)}</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-bold text-lg">
                                        {formatCurrency(card.current_balance)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                        of {formatCurrency(card.initial_balance)}
                                    </div>
                                    <Badge variant={card.current_balance > 0 ? "default" : "secondary"}>
                                        {card.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Issue Gift Card</DialogTitle>
                        <DialogDescription>
                            Create a new gift card manually. Use this for comps, refunds, or manual sales.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Initial Balance ($)</Label>
                            <Input
                                type="number"
                                placeholder="50.00"
                                value={issueForm.initial_balance}
                                onChange={e => setIssueForm({ ...issueForm, initial_balance: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Recipient Email (Optional)</Label>
                            <Input
                                type="email"
                                placeholder="customer@example.com"
                                value={issueForm.recipient_email}
                                onChange={e => setIssueForm({ ...issueForm, recipient_email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Custom Code (Optional)</Label>
                            <Input
                                placeholder="Leave empty to auto-generate"
                                value={issueForm.custom_code}
                                onChange={e => setIssueForm({ ...issueForm, custom_code: e.target.value.toUpperCase() })}
                            />
                            <p className="text-xs text-muted-foreground">Auto-generated format: GC-ABCD-1234</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Internal Notes (Optional)</Label>
                            <Input
                                placeholder="Reason for issue..."
                                value={issueForm.notes}
                                onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => issueCardMutation.mutate(issueForm)}
                            disabled={!issueForm.initial_balance || issueCardMutation.isPending}
                        >
                            {issueCardMutation.isPending ? 'Issuing...' : 'Issue Card'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
