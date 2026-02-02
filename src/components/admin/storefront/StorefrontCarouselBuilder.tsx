/**
 * Storefront Carousel Builder
 * Admin UI for creating and managing homepage carousels
 * Based on Flowhub's carousel customization feature
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
import { Separator } from '@/components/ui/separator';
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Edit from "lucide-react/dist/esm/icons/edit";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import Layers from "lucide-react/dist/esm/icons/layers";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Clock from "lucide-react/dist/esm/icons/clock";
import Tag from "lucide-react/dist/esm/icons/tag";
import Package from "lucide-react/dist/esm/icons/package";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";

interface Carousel {
    id: string;
    title: string;
    subtitle: string | null;
    sort_order: number;
    is_active: boolean;
    filter_type: string;
    filter_category: string | null;
    filter_tag: string | null;
    max_items: number;
    card_style: string;
    background_color: string | null;
}

interface CarouselBuilderProps {
    storeId: string;
}

const FILTER_TYPES = [
    { value: 'bestselling', label: 'Best Sellers', icon: TrendingUp, description: 'Products with most sales' },
    { value: 'newest', label: 'New Arrivals', icon: Clock, description: 'Recently added products' },
    { value: 'category', label: 'By Category', icon: Layers, description: 'Products in a specific category' },
    { value: 'tag', label: 'By Tag', icon: Tag, description: 'Products with a specific tag' },
    { value: 'manual', label: 'Hand-Picked', icon: Package, description: 'Manually select products' },
];

export function StorefrontCarouselBuilder({ storeId }: CarouselBuilderProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingCarousel, setEditingCarousel] = useState<Carousel | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newCarousel, setNewCarousel] = useState({
        title: '',
        subtitle: '',
        filter_type: 'bestselling',
        filter_category: '',
        filter_tag: '',
        max_items: 8,
        is_active: true,
    });

    // Fetch carousels
    const { data: carousels = [], isLoading } = useQuery({
        queryKey: ['store-carousels', storeId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_carousels')
                .select('*')
                .eq('store_id', storeId)
                .order('sort_order', { ascending: true });

            if (error) throw error;
            return data as Carousel[];
        },
        enabled: !!storeId,
    });

    // Create carousel mutation
    const createMutation = useMutation({
        mutationFn: async (carousel: typeof newCarousel) => {
            const { error } = await supabase
                .from('marketplace_carousels')
                .insert({
                    store_id: storeId,
                    title: carousel.title,
                    subtitle: carousel.subtitle || null,
                    filter_type: carousel.filter_type,
                    filter_category: carousel.filter_category || null,
                    filter_tag: carousel.filter_tag || null,
                    max_items: carousel.max_items,
                    is_active: carousel.is_active,
                    sort_order: carousels.length,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['store-carousels', storeId] });
            toast({ title: 'Carousel created!' });
            setIsCreateOpen(false);
            setNewCarousel({
                title: '',
                subtitle: '',
                filter_type: 'bestselling',
                filter_category: '',
                filter_tag: '',
                max_items: 8,
                is_active: true,
            });
        },
        onError: (error) => {
            toast({ title: 'Failed to create carousel', description: String(error), variant: 'destructive' });
        },
    });

    // Update carousel mutation
    const updateMutation = useMutation({
        mutationFn: async (carousel: Partial<Carousel> & { id: string }) => {
            const { id, ...updates } = carousel;
            const { error } = await supabase
                .from('marketplace_carousels')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['store-carousels', storeId] });
            toast({ title: 'Carousel updated!' });
            setEditingCarousel(null);
        },
    });

    // Delete carousel mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('marketplace_carousels')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['store-carousels', storeId] });
            toast({ title: 'Carousel deleted' });
        },
    });

    // Toggle active status
    const toggleActive = (carousel: Carousel) => {
        updateMutation.mutate({ id: carousel.id, is_active: !carousel.is_active });
    };

    // Move carousel up/down
    const moveCarousel = (carousel: Carousel, direction: 'up' | 'down') => {
        const currentIndex = carousels.findIndex(c => c.id === carousel.id);
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (newIndex < 0 || newIndex >= carousels.length) return;

        const other = carousels[newIndex];

        // Swap sort orders
        updateMutation.mutate({ id: carousel.id, sort_order: other.sort_order });
        updateMutation.mutate({ id: other.id, sort_order: carousel.sort_order });
    };

    const getFilterIcon = (filterType: string) => {
        const filter = FILTER_TYPES.find(f => f.value === filterType);
        return filter?.icon || Package;
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8 flex items-center justify-center">
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
                                <Layers className="h-5 w-5" />
                                Homepage Carousels
                            </CardTitle>
                            <CardDescription>
                                Create dynamic product carousels for your storefront
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Carousel
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {carousels.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No carousels yet</p>
                            <p className="text-sm">Add carousels to showcase products on your homepage</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {carousels.map((carousel, index) => {
                                const FilterIcon = getFilterIcon(carousel.filter_type);
                                return (
                                    <div
                                        key={carousel.id}
                                        className={`flex items-center gap-4 p-4 rounded-lg border ${carousel.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
                                            }`}
                                    >
                                        {/* Drag Handle & Order Controls */}
                                        <div className="flex flex-col gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => moveCarousel(carousel, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => moveCarousel(carousel, 'down')}
                                                disabled={index === carousels.length - 1}
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Carousel Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{carousel.title}</p>
                                                <Badge variant="secondary" className="text-xs">
                                                    <FilterIcon className="h-3 w-3 mr-1" />
                                                    {FILTER_TYPES.find(f => f.value === carousel.filter_type)?.label}
                                                </Badge>
                                            </div>
                                            {carousel.subtitle && (
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {carousel.subtitle}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                Max {carousel.max_items} items
                                                {carousel.filter_category && ` • Category: ${carousel.filter_category}`}
                                                {carousel.filter_tag && ` • Tag: ${carousel.filter_tag}`}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => toggleActive(carousel)}
                                                title={carousel.is_active ? 'Disable' : 'Enable'}
                                            >
                                                {carousel.is_active ? (
                                                    <Eye className="h-4 w-4" />
                                                ) : (
                                                    <EyeOff className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingCarousel(carousel)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => {
                                                    if (confirm('Delete this carousel?')) {
                                                        deleteMutation.mutate(carousel.id);
                                                    }
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

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Carousel</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                placeholder="e.g., Best Sellers, Staff Picks"
                                value={newCarousel.title}
                                onChange={(e) => setNewCarousel({ ...newCarousel, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Subtitle (optional)</Label>
                            <Input
                                placeholder="e.g., Our most popular products"
                                value={newCarousel.subtitle}
                                onChange={(e) => setNewCarousel({ ...newCarousel, subtitle: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Product Selection</Label>
                            <Select
                                value={newCarousel.filter_type}
                                onValueChange={(v) => setNewCarousel({ ...newCarousel, filter_type: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FILTER_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            <div className="flex items-center gap-2">
                                                <type.icon className="h-4 w-4" />
                                                <span>{type.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {newCarousel.filter_type === 'category' && (
                            <div className="space-y-2">
                                <Label>Category Name</Label>
                                <Input
                                    placeholder="e.g., Edibles, Flower"
                                    value={newCarousel.filter_category}
                                    onChange={(e) => setNewCarousel({ ...newCarousel, filter_category: e.target.value })}
                                />
                            </div>
                        )}
                        {newCarousel.filter_type === 'tag' && (
                            <div className="space-y-2">
                                <Label>Tag</Label>
                                <Input
                                    placeholder="e.g., sale, featured"
                                    value={newCarousel.filter_tag}
                                    onChange={(e) => setNewCarousel({ ...newCarousel, filter_tag: e.target.value })}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Max Items</Label>
                            <Select
                                value={String(newCarousel.max_items)}
                                onValueChange={(v) => setNewCarousel({ ...newCarousel, max_items: Number(v) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="4">4 items</SelectItem>
                                    <SelectItem value="6">6 items</SelectItem>
                                    <SelectItem value="8">8 items</SelectItem>
                                    <SelectItem value="10">10 items</SelectItem>
                                    <SelectItem value="12">12 items</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Active</Label>
                            <Switch
                                checked={newCarousel.is_active}
                                onCheckedChange={(checked) => setNewCarousel({ ...newCarousel, is_active: checked })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate(newCarousel)}
                            disabled={!newCarousel.title || createMutation.isPending}
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Carousel'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog (simplified - same as create for now) */}
            {editingCarousel && (
                <Dialog open={!!editingCarousel} onOpenChange={() => setEditingCarousel(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Carousel</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    value={editingCarousel.title}
                                    onChange={(e) => setEditingCarousel({ ...editingCarousel, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Subtitle</Label>
                                <Input
                                    value={editingCarousel.subtitle || ''}
                                    onChange={(e) => setEditingCarousel({ ...editingCarousel, subtitle: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Product Selection</Label>
                                <Select
                                    value={editingCarousel.filter_type}
                                    onValueChange={(v) => setEditingCarousel({ ...editingCarousel, filter_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FILTER_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex items-center gap-2">
                                                    <type.icon className="h-4 w-4" />
                                                    <span>{type.label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Max Items</Label>
                                <Select
                                    value={String(editingCarousel.max_items)}
                                    onValueChange={(v) => setEditingCarousel({ ...editingCarousel, max_items: Number(v) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="4">4 items</SelectItem>
                                        <SelectItem value="6">6 items</SelectItem>
                                        <SelectItem value="8">8 items</SelectItem>
                                        <SelectItem value="10">10 items</SelectItem>
                                        <SelectItem value="12">12 items</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingCarousel(null)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => updateMutation.mutate({
                                    id: editingCarousel.id,
                                    title: editingCarousel.title,
                                    subtitle: editingCarousel.subtitle,
                                    filter_type: editingCarousel.filter_type,
                                    max_items: editingCarousel.max_items,
                                })}
                                disabled={updateMutation.isPending}
                            >
                                {updateMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

export default StorefrontCarouselBuilder;
