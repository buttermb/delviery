import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SkeletonCard } from '@/components/ui/skeleton';
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
import { Plus, MoreVertical, Edit2, Trash2, ShieldCheck, DollarSign, Percent, Loader2, AlertCircle } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';

interface PricingTier {
    id: string;
    name: string;
    color: string;
    discount_percentage: number;
    min_order_amount: number;
    description: string;
    active: boolean;
}

const TIER_COLORS = [
    { label: 'Bronze', value: 'bg-orange-100 text-orange-800 border-orange-200' },
    { label: 'Silver', value: 'bg-slate-100 text-slate-800 border-slate-200' },
    { label: 'Gold', value: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { label: 'Blue', value: 'bg-blue-100 text-blue-800 border-blue-200' },
    { label: 'Green', value: 'bg-green-100 text-green-800 border-green-200' },
    { label: 'Purple', value: 'bg-purple-100 text-purple-800 border-purple-200' },
    { label: 'Rose', value: 'bg-rose-100 text-rose-800 border-rose-200' },
    { label: 'Teal', value: 'bg-teal-100 text-teal-800 border-teal-200' },
] as const;

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

const tierFormSchema = z.object({
    name: z.string().min(1, 'Tier name is required').max(50, 'Name must be 50 characters or less'),
    discount_percentage: z.coerce.number().min(0, 'Discount must be 0 or more').max(100, 'Discount cannot exceed 100%'),
    min_order_amount: z.coerce.number().min(0, 'Minimum order must be 0 or more'),
    description: z.string().max(200, 'Description must be 200 characters or less').optional().default(''),
    color: z.string().min(1, 'Color is required'),
    active: z.boolean(),
});

type TierFormValues = z.infer<typeof tierFormSchema>;

export default function PricingTiersPage() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
    const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

    const form = useForm<TierFormValues>({
        resolver: zodResolver(tierFormSchema),
        defaultValues: {
            name: '',
            discount_percentage: 0,
            min_order_amount: 0,
            description: '',
            color: TIER_COLORS[0].value,
            active: true,
        },
    });

    // Fetch pricing tiers — uses same path as NewWholesaleOrder
    const { data: tiers = DEFAULT_TIERS, isLoading, isError, error: queryError } = useQuery({
        queryKey: queryKeys.wholesalePricingTiers.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return DEFAULT_TIERS;
            const { data, error } = await supabase
                .from('account_settings')
                .select('integration_settings')
                .eq('account_id', tenant.id)
                .maybeSingle();

            if (error) throw error;

            const settings = (data?.integration_settings as Record<string, unknown>) || {};
            const pricingConfig = settings?.wholesale_pricing_tiers as { tiers?: PricingTier[] } | undefined;
            return pricingConfig?.tiers ?? DEFAULT_TIERS;
        },
        enabled: !!tenant?.id,
        retry: 2,
    });

    // Mutation to save tiers — writes to same path as NewWholesaleOrder reads
    const saveTiersMutation = useMutation({
        mutationFn: async (newTiers: PricingTier[]) => {
            if (!tenant?.id) return;

            const { data: currentSettings } = await supabase
                .from('account_settings')
                .select('integration_settings')
                .eq('account_id', tenant.id)
                .maybeSingle();

            const currentIntegrationSettings = (currentSettings?.integration_settings as Record<string, unknown>) || {};

            const { error } = await supabase
                .from('account_settings')
                .update({
                    integration_settings: {
                        ...currentIntegrationSettings,
                        wholesale_pricing_tiers: { tiers: newTiers }
                    }
                })
                .eq('account_id', tenant.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.wholesalePricingTiers.byTenant(tenant?.id) });
            toast.success('Pricing tiers updated successfully');
            setIsDialogOpen(false);
            setEditingTier(null);
        },
        onError: (error) => {
            logger.error('Failed to save tiers', error);
            toast.error('Failed to save pricing tiers', { description: humanizeError(error) });
        }
    });

    const openCreateDialog = () => {
        setEditingTier(null);
        form.reset({
            name: '',
            discount_percentage: 0,
            min_order_amount: 0,
            description: '',
            color: TIER_COLORS[0].value,
            active: true,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (tier: PricingTier) => {
        setEditingTier(tier);
        form.reset({
            name: tier.name,
            discount_percentage: tier.discount_percentage,
            min_order_amount: tier.min_order_amount,
            description: tier.description,
            color: tier.color,
            active: tier.active,
        });
        setIsDialogOpen(true);
    };

    const handleSaveTier = (values: TierFormValues) => {
        const newTier: PricingTier = {
            id: editingTier?.id || crypto.randomUUID(),
            name: values.name,
            color: values.color,
            discount_percentage: values.discount_percentage,
            min_order_amount: values.min_order_amount,
            description: values.description || '',
            active: values.active,
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

    const handleToggleActive = (tier: PricingTier) => {
        const newTiers = tiers.map(t =>
            t.id === tier.id ? { ...t, active: !t.active } : t
        );
        saveTiersMutation.mutate(newTiers);
    };

    if (isError) {
        return (
            <div className="p-4 max-w-7xl mx-auto">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                    <h2 className="text-lg font-semibold">Failed to load pricing tiers</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {humanizeError(queryError)}
                    </p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.wholesalePricingTiers.byTenant(tenant?.id) })}
                    >
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Pricing Tiers</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage wholesale pricing tiers, discounts, and order minimums.
                    </p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Tier
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <>
                        <SkeletonCard hasFooter lines={2} />
                        <SkeletonCard hasFooter lines={2} />
                        <SkeletonCard hasFooter lines={2} />
                    </>
                ) : (
                    <>
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
                                                <Button variant="ghost" className="h-11 w-11 p-0" aria-label={`Actions for ${tier.name} tier`}>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(tier)}>
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleActive(tier)}>
                                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                                    {tier.active ? 'Deactivate' : 'Activate'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDeleteTier(tier)}
                                                    className="text-destructive focus-visible:text-destructive"
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
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}

                        {/* Add New Tier Card */}
                        <Button
                            variant="outline"
                            className="h-full min-h-[300px] flex flex-col items-center justify-center gap-4 border-dashed bg-muted/20 hover:bg-muted/50"
                            onClick={openCreateDialog}
                        >
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                <Plus className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-lg">Create New Tier</h3>
                                <p className="text-sm text-muted-foreground">Define a new pricing level</p>
                            </div>
                        </Button>
                    </>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <form onSubmit={form.handleSubmit(handleSaveTier)}>
                        <DialogHeader>
                            <DialogTitle>{editingTier ? 'Edit Tier' : 'New Pricing Tier'}</DialogTitle>
                            <DialogDescription>
                                Configure the discount and requirements for this tier.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Tier Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Platinum"
                                    {...form.register('name')}
                                />
                                {form.formState.errors.name && (
                                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="discount_percentage">Discount Percentage</Label>
                                    <div className="relative">
                                        <Input
                                            id="discount_percentage"
                                            type="number"
                                            min="0"
                                            max="100"
                                            {...form.register('discount_percentage')}
                                        />
                                        <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {form.formState.errors.discount_percentage && (
                                        <p className="text-sm text-destructive">{form.formState.errors.discount_percentage.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="min_order_amount">Minimum Order ($)</Label>
                                    <div className="relative">
                                        <Input
                                            id="min_order_amount"
                                            type="number"
                                            min="0"
                                            {...form.register('min_order_amount')}
                                        />
                                        <DollarSign className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {form.formState.errors.min_order_amount && (
                                        <p className="text-sm text-destructive">{form.formState.errors.min_order_amount.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Short description of benefits"
                                    rows={2}
                                    {...form.register('description')}
                                />
                                {form.formState.errors.description && (
                                    <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Tier Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {TIER_COLORS.map((colorOption) => (
                                        <button
                                            key={colorOption.label}
                                            type="button"
                                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${colorOption.value} ${
                                                form.watch('color') === colorOption.value
                                                    ? 'ring-2 ring-primary ring-offset-2'
                                                    : 'opacity-60 hover:opacity-100'
                                            }`}
                                            onClick={() => form.setValue('color', colorOption.value)}
                                        >
                                            {colorOption.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="active">Active</Label>
                                    <p className="text-xs text-muted-foreground">Enable this tier for wholesale orders</p>
                                </div>
                                <Switch
                                    id="active"
                                    checked={form.watch('active')}
                                    onCheckedChange={(checked) => form.setValue('active', checked)}
                                />
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
