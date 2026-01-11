/**
 * Storefront Deals Manager
 * Admin UI for managing scheduled and targeted promotions
 * Supports "Munchie Monday", Category discounts, etc.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
    Plus,
    Trash2,
    Edit,
    Calendar,
    Percent,
    DollarSign,
    Tag,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface Deal {
    id: string;
    name: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    applies_to: 'order' | 'category' | 'brand' | 'collection' | 'product';
    target_value: string | null;
    active_days: number[]; // 0-6
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    min_order_amount: number;
    first_time_only?: boolean;
    max_uses_per_customer?: number;
}

interface DealsManagerProps {
    storeId: string;
}

const DAYS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

export function StorefrontDealsManager({ storeId }: DealsManagerProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        discount_type: 'percentage' as const,
        discount_value: '',
        applies_to: 'order' as const,
        target_value: '',
        active_days: [0, 1, 2, 3, 4, 5, 6],
        is_active: true,
        start_date: '',
        end_date: '',
        min_order_amount: '',
        first_time_only: false,
        max_uses_per_customer: '',
    });

    // Fetch Deals
    const { data: deals = [], isLoading } = useQuery({
        queryKey: ['marketplace-deals', storeId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_deals')
                .select('*')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Deal[];
        },
        enabled: !!storeId,
    });

    // Mutation: Create/Update
    const saveDealMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                store_id: storeId,
                name: data.name,
                description: data.description || null,
                discount_type: data.discount_type,
                discount_value: Number(data.discount_value),
                applies_to: data.applies_to,
                target_value: data.applies_to === 'order' ? null : data.target_value,
                active_days: data.active_days,
                is_active: data.is_active,
                start_date: data.start_date || null,
                end_date: data.end_date || null,
                min_order_amount: Number(data.min_order_amount) || 0,
                first_time_only: data.first_time_only,
                max_uses_per_customer: data.max_uses_per_customer ? Number(data.max_uses_per_customer) : null,
            };

            if (editingDeal) {
                const { error } = await supabase
                    .from('marketplace_deals')
                    .update(payload)
                    .eq('id', editingDeal.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('marketplace_deals')
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-deals', storeId] });
            toast({ title: editingDeal ? 'Deal updated!' : 'Deal created!' });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (err) => {
            toast({
                title: 'Error saving deal',
                description: err.message,
                variant: 'destructive'
            });
        },
    });

    // Mutation: Delete
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('marketplace_deals').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-deals', storeId] });
            toast({ title: 'Deal deleted' });
        },
    });

    // Toggle Active Status
    const toggleActive = async (deal: Deal) => {
        const { error } = await supabase
            .from('marketplace_deals')
            .update({ is_active: !deal.is_active })
            .eq('id', deal.id);

        if (error) {
            toast({ title: 'Error updating status', variant: 'destructive' });
            return;
        }

        queryClient.invalidateQueries({ queryKey: ['marketplace-deals', storeId] });
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            discount_type: 'percentage',
            discount_value: '',
            applies_to: 'order',
            target_value: '',
            active_days: [0, 1, 2, 3, 4, 5, 6],
            is_active: true,
            start_date: '',
            end_date: '',
            min_order_amount: '',
            first_time_only: false,
            max_uses_per_customer: '',
        });
        setEditingDeal(null);
    };

    const openEdit = (deal: Deal) => {
        setEditingDeal(deal);
        setFormData({
            name: deal.name,
            description: deal.description || '',
            discount_type: deal.discount_type,
            discount_value: String(deal.discount_value),
            applies_to: deal.applies_to,
            target_value: deal.target_value || '',
            active_days: deal.active_days || [],
            is_active: deal.is_active,
            start_date: deal.start_date ? deal.start_date.split('T')[0] : '',
            end_date: deal.end_date ? deal.end_date.split('T')[0] : '',
            min_order_amount: String(deal.min_order_amount || ''),
            first_time_only: deal.first_time_only || false,
            max_uses_per_customer: String(deal.max_uses_per_customer || ''),
        });
        setIsDialogOpen(true);
    };

    const toggleDay = (dayValue: number) => {
        setFormData(prev => {
            const current = prev.active_days;
            if (current.includes(dayValue)) {
                return { ...prev, active_days: current.filter(d => d !== dayValue).sort() };
            } else {
                return { ...prev, active_days: [...current, dayValue].sort() };
            }
        });
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Tag className="h-5 w-5" />
                                Deals & Promotions
                            </CardTitle>
                            <CardDescription>
                                Manage scheduled promotions like "Munchie Monday" or "20% off Branding"
                            </CardDescription>
                        </div>
                        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Deal
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {deals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No active deals</p>
                            <p className="text-sm">Create a recurring or limited-time promotion</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {deals.map(deal => {
                                const isAllDays = deal.active_days?.length === 7;

                                return (
                                    <div
                                        key={deal.id}
                                        className={`flex flex-col md:flex-row items-center gap-4 p-4 rounded-lg border ${!deal.is_active ? 'opacity-60 bg-muted/50' : 'bg-background'
                                            }`}
                                    >
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-lg">{deal.name}</span>
                                                <Badge variant={deal.is_active ? 'default' : 'secondary'}>
                                                    {deal.discount_type === 'percentage'
                                                        ? `${deal.discount_value}% OFF`
                                                        : `$${deal.discount_value} OFF`}
                                                </Badge>
                                                {deal.applies_to !== 'order' && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {deal.applies_to}: {deal.target_value}
                                                    </Badge>
                                                )}
                                            </div>

                                            {deal.description && (
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    {deal.description}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {isAllDays ? 'Every day' : (
                                                        deal.active_days.map(d => DAYS[d].label).join(', ')
                                                    )}
                                                </div>

                                                {(deal.start_date || deal.end_date) && (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {deal.start_date ? formatSmartDate(deal.start_date) : 'Now'}
                                                        {' → '}
                                                        {deal.end_date ? formatSmartDate(deal.end_date) : 'Forever'}
                                                    </div>
                                                )}

                                                {deal.min_order_amount > 0 && (
                                                    <div>Min Order: {formatCurrency(deal.min_order_amount)}</div>
                                                )}
                                                {deal.first_time_only && (
                                                    <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                                                        New Customers Only
                                                    </Badge>
                                                )}
                                                {deal.max_uses_per_customer && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        Limit: {deal.max_uses_per_customer}/customer
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleActive(deal)}
                                                className={deal.is_active ? 'text-green-600' : 'text-muted-foreground'}
                                            >
                                                {deal.is_active ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(deal)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => {
                                                    if (confirm('Delete this deal?')) deleteMutation.mutate(deal.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingDeal ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
                        <DialogDescription>
                            Configure scheduled discounts and targeted promotions
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                        <div className="space-y-2">
                            <Label>Deal Name</Label>
                            <Input
                                placeholder="e.g. Munchie Monday"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description (Public)</Label>
                            <Textarea
                                placeholder="e.g. Get 20% off all edibles every Monday!"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Discount Type</Label>
                                <Select
                                    value={formData.discount_type}
                                    onValueChange={(v: any) => setFormData({ ...formData, discount_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Value</Label>
                                <Input
                                    type="number"
                                    placeholder={formData.discount_type === 'percentage' ? '20' : '5.00'}
                                    value={formData.discount_value}
                                    onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Applies To</Label>
                                <Select
                                    value={formData.applies_to}
                                    onValueChange={(v: any) => setFormData({ ...formData, applies_to: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="order">Entire Order</SelectItem>
                                        <SelectItem value="category">Specific Category</SelectItem>
                                        <SelectItem value="brand">Specific Brand</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.applies_to !== 'order' && (
                                <div className="space-y-2">
                                    <Label>Target Name</Label>
                                    <Input
                                        placeholder={formData.applies_to === 'category' ? 'e.g. Edibles' : 'e.g. Wyld'}
                                        value={formData.target_value}
                                        onChange={e => setFormData({ ...formData, target_value: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Active Days</Label>
                            <div className="flex flex-wrap gap-2">
                                {DAYS.map(day => (
                                    <Button
                                        key={day.value}
                                        type="button"
                                        variant={formData.active_days.includes(day.value) ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 w-10 p-0"
                                        onClick={() => toggleDay(day.value)}
                                    >
                                        {day.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Selected: {formData.active_days.length === 7 ? 'Every Day' : formData.active_days.map(d => DAYS[d].label).join(', ')}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date (Optional)</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date (Optional)</Label>
                                <Input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2 border-t">
                            <h4 className="font-medium text-sm text-muted-foreground">Restrictions</h4>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="first_time"
                                    checked={formData.first_time_only}
                                    onCheckedChange={c => setFormData({ ...formData, first_time_only: c })}
                                />
                                <Label htmlFor="first_time">One-time Discount (New Customers Only)</Label>
                            </div>

                            <div className="space-y-2">
                                <Label>Max Uses per Customer (Optional)</Label>
                                <Input
                                    type="number"
                                    placeholder="Leave empty for unlimited"
                                    value={formData.max_uses_per_customer}
                                    onChange={e => setFormData({ ...formData, max_uses_per_customer: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">Limit how many times a single customer can redeem this deal</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="active"
                                checked={formData.is_active}
                                onCheckedChange={c => setFormData({ ...formData, is_active: c })}
                            />
                            <Label htmlFor="active">Deal is currently active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => saveDealMutation.mutate(formData)}
                            disabled={saveDealMutation.isPending || !formData.name || !formData.discount_value}
                        >
                            {saveDealMutation.isPending ? 'Saving...' : 'Save Deal'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
