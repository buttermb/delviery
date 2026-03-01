import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/lib/queryKeys';

interface PayoutRecord {
    id: string;
    seller_tenant_id: string;
    amount: number;
    method?: string;
    status: string;
    created_at: string;
    tenant?: { business_name: string; slug: string };
}

export default function PlatformPayoutsPage() {
    const { isPlatformAdmin } = usePlatformAdmin();
    const queryClient = useQueryClient();
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
    const [rejectReason, setRejectReason] = useState('');

    // Fetch pending payouts
    const { data: payouts = [], isLoading } = useQuery({
        queryKey: queryKeys.platformPayouts.pending(),
        queryFn: async () => {
            // Need to join with tenants to see WHO is asking
            // Supabase join syntax: tenant:tenants!marketplace_payouts_seller_tenant_id_fkey (*)
            const { data, error } = await supabase
                .from('marketplace_payouts' as 'tenants') // Supabase type limitation
                .select(`
            *,
            tenant:tenants!marketplace_payouts_seller_tenant_id_fkey (
                business_name,
                slug
            )
        `)
                .in('status', ['pending', 'processing'])
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: isPlatformAdmin,
    });

    // Approve Mutation
    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('marketplace_payouts' as 'tenants') // Supabase type limitation
                .update({
                    status: 'completed',
                    processed_at: new Date().toISOString()
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Payout Approved", { description: "Funds marked as transferred." });
            queryClient.invalidateQueries({ queryKey: queryKeys.platformPayouts.pending() });
        },
        onError: (error) => {
            toast.error("Error", { description: humanizeError(error) });
        }
    });

    // Reject Mutation
    const rejectMutation = useMutation({
        mutationFn: async () => {
            if (!rejectDialog.id) return;
            const { error } = await supabase
                .from('marketplace_payouts' as 'tenants') // Supabase type limitation
                .update({
                    status: 'failed', // or rejected
                    notes: rejectReason,
                    processed_at: new Date().toISOString()
                })
                .eq('id', rejectDialog.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Payout Rejected", { description: "Vendor has been notified." });
            setRejectDialog({ open: false, id: null });
            setRejectReason('');
            queryClient.invalidateQueries({ queryKey: queryKeys.platformPayouts.pending() });
        },
        onError: (error) => {
            toast.error("Error", { description: humanizeError(error) });
        }
    });

    if (isLoading) return <EnhancedLoadingState variant="table" message="Loading payouts..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Payout Approvals"
                description="Review and process vendor withdrawal requests."
            />

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Requested</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payouts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No pending payouts.
                                </TableCell>
                            </TableRow>
                        ) : (
                            (payouts as unknown as PayoutRecord[]).map((payout) => (
                                <TableRow key={payout.id}>
                                    <TableCell>
                                        <div className="font-medium">{payout.tenant?.business_name}</div>
                                        <div className="text-xs text-muted-foreground">ID: {payout.seller_tenant_id?.slice(0, 8)}...</div>
                                    </TableCell>
                                    <TableCell>{formatSmartDate(payout.created_at)}</TableCell>
                                    <TableCell className="font-bold">{formatCurrency(payout.amount)}</TableCell>
                                    <TableCell className="capitalize">{payout.method ?? '—'}</TableCell>
                                    <TableCell><Badge variant="secondary">{payout.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => approveMutation.mutate(payout.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                                                {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                                Approve
                                            </Button>
                                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setRejectDialog({ open: true, id: payout.id })}>
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Reject
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ open: false, id: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Payout</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this payout request. This will be visible to the vendor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g., Invalid bank details..."
                            rows={4}
                            aria-label="Rejection reason"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectDialog({ open: false, id: null })}>Cancel</Button>
                        <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={!rejectReason.trim() || rejectMutation.isPending}>
                            {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Reject Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
