import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Edit2, Trash2, ShieldCheck, Users, DollarSign, Percent, Loader2 } from 'lucide-react';

interface PricingTier {
    id: string;
    name: string;
    color: string;
    discount_percentage: number;
    min_order_amount: number;
    description: string;
    active: boolean;
}

const DEFAULT_TIERS: PricingTier[] = [
    {
        id: 'bronze',
        name: 'Bronze',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        discount_percentage: 0,
        min_order_amount: 0,
        description: 'Standard pricing for all new partners',
        active: true
    },
    {
        id: 'silver',
        name: 'Silver',
        color: 'bg-slate-100 text-slate-800 border-slate-200',
        discount_percentage: 5,
        min_order_amount: 1000,
        description: '5% discount for orders over $1,000',
        active: true
    },
    {
        id: 'gold',
        name: 'Gold',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        discount_percentage: 10,
        min_order_amount: 5000,
        description: '10% discount for orders over $5,000',
        active: true
    }
];

export default function PricingTiersPage() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
    const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

    // Fetch settings to get tiers
    const { data: settings } = useQuery({
        queryKey: ['account-settings', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) return null;
            const { data, error } = await supabase
                .from('account_settings')
                .select('integration_settings')
                .eq('account_id', tenant.id)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!tenant?.id,
    });

    const tiers: PricingTier[] = (settings?.integration_settings as any)?.pricing_tiers || DEFAULT_TIERS;

    // Mutation to save tiers
    const saveTiersMutation = useMutation({
        mutationFn: async (newTiers: PricingTier[]) => {
            if (!tenant?.id) return;

            // Get current settings first to merge
            const { data: currentSettings } = await supabase
                .from('account_settings')
                .select('integration_settings')
                .eq('account_id', tenant.id)
                .maybeSingle();

            const currentIntegrationSettings = (currentSettings?.integration_settings as any) || {};

            const { error } = await supabase
                .from('account_settings')
                .update({
                    integration_settings: {
                        ...currentIntegrationSettings,
                        pricing_tiers: newTiers
                    }
                })
                .eq('account_id', tenant.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['account-settings'] });
            toast.success('Pricing tiers updated successfully');
            setIsDialogOpen(false);
            setEditingTier(null);
        },
        onError: (error) => {
            logger.error('Failed to save tiers', error);
            toast.error('Failed to save pricing tiers');
        }
    });

    const handleSaveTier = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const newTier: PricingTier = {
            id: editingTier?.id || crypto.randomUUID(),
            name: formData.get('name') as string,
            color: 'bg-blue-100 text-blue-800 border-blue-200', // Default for custom
            discount_percentage: Number(formData.get('discount')),
            min_order_amount: Number(formData.get('min_order')),
            description: formData.get('description') as string,
            active: true
        };

        const newTiers = editingTier
            ? tiers.map(t => t.id === editingTier.id ? newTier : t)
            : [...tiers, newTier];

        saveTiersMutation.mutate(newTiers);
    };

    const handleDeleteTier = (tier: PricingTier) => {
        confirm({
            title: 'Delete Pricing Tier',
            itemName: tier.name,
            itemType: 'pricing tier',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const newTiers = tiers.filter(t => t.id !== tier.id);
                    await saveTiersMutation.mutateAsync(newTiers);
                    closeDialog();
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Pricing Tiers</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage wholesale pricing tiers, discounts, and order minimums.
                    </p>
                </div>
                <Button onClick={() => { setEditingTier(null); setIsDialogOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Tier
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tiers.map((tier) => (
                    <Card key={tier.id} className="relative overflow-hidden transition-all hover:shadow-md">
                        <div className={`absolute top-0 left-0 w-1 h-full ${tier.color.replace('text-', 'bg-').split(' ')[0]}`} />
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className={`${tier.color} mb-2`}>
                                    {tier.name}
                                </Badge>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-11 w-11 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingTier(tier); setIsDialogOpen(true); }}>
                                            <Edit2 className="h-4 w-4 mr-2" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleDeleteTier(tier)}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <CardTitle className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold">{tier.discount_percentage}%</span>
                                <span className="text-sm font-medium text-muted-foreground">Discount</span>
                            </CardTitle>
                            <CardDescription>{tier.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-full">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Minimum Order</p>
                                        <p className="text-base font-bold">${tier.min_order_amount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 p-4">
                            <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    {tier.active ? 'Active' : 'Inactive'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    0 Clients
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {/* Add New Tier Card (Empty State) */}
                <Button
                    variant="outline"
                    className="h-full min-h-[300px] flex flex-col items-center justify-center gap-4 border-dashed bg-muted/20 hover:bg-muted/50"
                    onClick={() => { setEditingTier(null); setIsDialogOpen(true); }}
                >
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-lg">Create New Tier</h3>
                        <p className="text-sm text-muted-foreground">Define a new pricing level</p>
                    </div>
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleSaveTier}>
                        <DialogHeader>
                            <DialogTitle>{editingTier ? 'Edit Tier' : 'New Pricing Tier'}</DialogTitle>
                            <DialogDescription>
                                Configure the discount and requirements for this tier.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Tier Name</Label>
                                <Input id="name" name="name" defaultValue={editingTier?.name} placeholder="e.g. Platinum" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="discount">Discount Percentage</Label>
                                    <div className="relative">
                                        <Input id="discount" name="discount" type="number" min="0" max="100" defaultValue={editingTier?.discount_percentage} required />
                                        <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="min_order">Minimum Order ($)</Label>
                                    <div className="relative">
                                        <Input id="min_order" name="min_order" type="number" min="0" defaultValue={editingTier?.min_order_amount} required />
                                        <DollarSign className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input id="description" name="description" defaultValue={editingTier?.description} placeholder="Short description of benefits" />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saveTiersMutation.isPending}>
                                {saveTiersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save Tier
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={dialogState.open}
                onOpenChange={(open) => !open && closeDialog()}
                onConfirm={dialogState.onConfirm}
                title={dialogState.title}
                description={dialogState.description}
                itemName={dialogState.itemName}
                itemType={dialogState.itemType}
                isLoading={dialogState.isLoading}
            />
        </div>
    );
}
