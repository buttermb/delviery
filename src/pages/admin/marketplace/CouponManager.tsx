
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Tag, Trash2, Calendar, Loader2 } from "lucide-react";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

type Coupon = {
    id: string;
    tenant_id: string;
    code: string;
    type: 'percentage' | 'fixed_amount'; // Frontend type
    discount_type: 'percentage' | 'fixed_amount'; // DB type might differ, we map it
    discount_value: number;
    amount?: number; // For backward compat/display logic if needed
    usage_limit: number | null;
    used_count: number;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
};

export default function CouponManager() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form state
    const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
        type: 'percentage',
        is_active: true,
        used_count: 0
    });

    // Fetch coupons
    const { data: coupons, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceCoupons.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];
            const { data, error } = await supabase
                .from('marketplace_coupons')
                .select('id, tenant_id, code, discount_type, discount_value, usage_limit, used_count, start_date, end_date, is_active, created_at')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data.map((c) => ({
                ...c,
                type: c.discount_type, // Map DB field to UI field if needed
                amount: c.discount_value
            })) as Coupon[];
        },
        enabled: !!tenant?.id
    });

    // Mutations
    const createCoupon = useMutation({
        mutationFn: async (couponData: Partial<Coupon>) => {
            if (!tenant?.id) throw new Error("No tenant");

            const payload = {
                tenant_id: tenant.id,
                code: couponData.code?.toUpperCase(),
                discount_type: couponData.type,
                discount_value: couponData.amount,
                usage_limit: couponData.usage_limit,
                end_date: couponData.end_date || null,
                is_active: true
            };

            const { error } = await supabase
                .from('marketplace_coupons')
                .insert([payload]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCoupons.all });
            setIsDialogOpen(false);
            setNewCoupon({ type: 'percentage', is_active: true, used_count: 0 });
            toast.success("Coupon created successfully");
        },
        onError: (err) => toast.error("Failed to create coupon: " + err.message)
    });

    const deleteCoupon = useMutation({
        mutationFn: async (id: string) => {
            if (!tenant?.id) throw new Error("No tenant");
            const { error } = await supabase
                .from('marketplace_coupons')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenant.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCoupons.all });
            toast.success("Coupon deleted");
        },
        onError: () => toast.error("Failed to delete coupon")
    });
    
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

    const handleCreate = () => {
        if (!newCoupon.code || !newCoupon.amount) {
            toast.error("Please fill in required fields (Code and Value)");
            return;
        }
        createCoupon.mutate(newCoupon);
    };

    if (isLoading) return <EnhancedLoadingState variant="table" message="Loading coupons..." />;

    return (
        <div className="space-y-4 h-full p-4 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Coupons & Discounts</h1>
                    <p className="text-muted-foreground mt-1">
                        Create and manage discount codes for your store.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Coupon
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Coupon</DialogTitle>
                            <DialogDescription>
                                Add a new discount code for your customers.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="code" className="text-right">Code</Label>
                                <Input
                                    id="code"
                                    value={newCoupon.code ?? ''}
                                    onChange={e => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    placeholder="SUMMER25"
                                    className="col-span-3 uppercase"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="type" className="text-right">Type</Label>
                                <Select
                                    value={newCoupon.type}
                                    onValueChange={(val) => setNewCoupon(prev => ({ ...prev, type: val as 'percentage' | 'fixed_amount' }))}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="amount" className="text-right">Value</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={newCoupon.amount || ''}
                                    onChange={e => setNewCoupon(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                    placeholder="20"
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="limit" className="text-right">Limit</Label>
                                <Input
                                    id="limit"
                                    type="number"
                                    value={newCoupon.usage_limit || ''}
                                    onChange={e => setNewCoupon(prev => ({ ...prev, usage_limit: Number(e.target.value) }))}
                                    placeholder="Total uses (optional)"
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="expiry" className="text-right">Expires</Label>
                                <Input
                                    id="expiry"
                                    type="date"
                                    value={newCoupon.end_date ? format(new Date(newCoupon.end_date), 'yyyy-MM-dd') : ''}
                                    onChange={e => setNewCoupon(prev => ({ ...prev, end_date: e.target.value }))}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} disabled={createCoupon.isPending}>
                                {createCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Coupon
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Coupons</CardTitle>
                    <CardDescription>Manage your running promotions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {coupons?.map((coupon) => (
                                <TableRow key={coupon.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-primary" />
                                            {coupon.code}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {coupon.type === 'percentage' ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)}
                                    </TableCell>
                                    <TableCell>
                                        {coupon.used_count} / {coupon.usage_limit || '∞'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                                            {coupon.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {coupon.end_date ? (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(coupon.end_date), 'MMM d, yyyy')}
                                            </div>
                                        ) : 'Never'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => {
                                            setCouponToDelete(coupon);
                                            setDeleteDialogOpen(true);
                                        }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {coupons?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No coupons found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={() => couponToDelete && deleteCoupon.mutate(couponToDelete.id)}
                itemName={couponToDelete?.code || 'this coupon'}
                isLoading={deleteCoupon.isPending}
            />
        </div>
    );
}
