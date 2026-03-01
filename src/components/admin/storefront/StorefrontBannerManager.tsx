/**
 * Storefront Banner Manager
 * Admin UI for managing rotating hero banners
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { queryKeys } from '@/lib/queryKeys';
import {
    Plus,
    Trash2,
    Edit,
    MoveUp,
    MoveDown,
    Image as ImageIcon,
    Link as LinkIcon,
    Eye,
    EyeOff,
    Loader2,
} from 'lucide-react';

interface Banner {
    id: string;
    store_id: string;
    heading: string | null;
    subheading: string | null;
    button_text: string | null;
    button_link: string | null;
    image_url: string;
    display_order: number;
    is_active: boolean;
}

interface BannerManagerProps {
    storeId: string;
}

export function StorefrontBannerManager({ storeId }: BannerManagerProps) {
    const queryClient = useQueryClient();
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);

    const [formData, setFormData] = useState({
        heading: '',
        subheading: '',
        button_text: '',
        button_link: '',
        image_url: '',
        display_order: 0,
        is_active: true,
    });

    // Fetch Banners
    const { data: banners = [], isLoading } = useQuery({
        queryKey: queryKeys.marketplaceBanners.byStore(storeId),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('marketplace_banners')
                .select('id, store_id, heading, subheading, button_text, button_link, image_url, display_order, is_active')
                .eq('store_id', storeId)
                .order('display_order', { ascending: true });

            if (error) throw error;
            return data as Banner[];
        },
        enabled: !!storeId,
    });

    // Mutation: Create/Update
    const saveBannerMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                store_id: storeId,
                heading: data.heading || null,
                subheading: data.subheading || null,
                button_text: data.button_text || null,
                button_link: data.button_link || null,
                image_url: data.image_url,
                display_order: data.display_order,
                is_active: data.is_active,
            };

            if (editingBanner) {
                const { error } = await supabase
                    .from('marketplace_banners')
                    .update(payload)
                    .eq('id', editingBanner.id);
                if (error) throw error;
            } else {
                // Get max order for new items
                const maxOrder = banners.length > 0
                    ? Math.max(...banners.map(b => b.display_order))
                    : -1;

                const { error } = await supabase
                    .from('marketplace_banners')
                    .insert({ ...payload, display_order: maxOrder + 1 });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBanners.byStore(storeId) });
            toast.success(editingBanner ? 'Banner updated!' : 'Banner created!');
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (err) => {
            toast.error("Error saving banner", { description: humanizeError(err) });
        },
    });

    // Mutation: Delete
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('marketplace_banners').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBanners.byStore(storeId) });
            toast.success("Banner deleted");
        },
    });

    // Mutation: Reorder
    const reorderMutation = useMutation({
        mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
            const { error } = await supabase
                .from('marketplace_banners')
                .update({ display_order: newOrder })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBanners.byStore(storeId) });
        },
    });

    const moveBanner = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === banners.length - 1) return;

        const currentBanner = banners[index];
        const swapBanner = banners[direction === 'up' ? index - 1 : index + 1];

        // Optimistic update
        reorderMutation.mutate({ id: currentBanner.id, newOrder: swapBanner.display_order });
        reorderMutation.mutate({ id: swapBanner.id, newOrder: currentBanner.display_order });
    };

    // Toggle Active Status
    const toggleActive = async (banner: Banner) => {
        const { error } = await supabase
            .from('marketplace_banners')
            .update({ is_active: !banner.is_active })
            .eq('id', banner.id);

        if (error) {
            toast.error("Error updating status");
            return;
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBanners.byStore(storeId) });
    };

    const resetForm = () => {
        setFormData({
            heading: '',
            subheading: '',
            button_text: '',
            button_link: '',
            image_url: '',
            display_order: 0,
            is_active: true,
        });
        setEditingBanner(null);
    };

    const openEdit = (banner: Banner) => {
        setEditingBanner(banner);
        setFormData({
            heading: banner.heading ?? '',
            subheading: banner.subheading ?? '',
            button_text: banner.button_text ?? '',
            button_link: banner.button_link ?? '',
            image_url: banner.image_url,
            display_order: banner.display_order,
            is_active: banner.is_active,
        });
        setIsDialogOpen(true);
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
                                <ImageIcon className="h-5 w-5" />
                                Hero Banners
                            </CardTitle>
                            <CardDescription>
                                Manage rotating banners for your storefront homepage
                            </CardDescription>
                        </div>
                        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Banner
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {banners.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No banners yet</p>
                            <p className="text-sm">Create your first rotating banner</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {banners.map((banner, index) => (
                                <div
                                    key={banner.id}
                                    className={`flex flex-col md:flex-row items-center gap-4 p-4 rounded-lg border bg-card ${!banner.is_active ? 'opacity-60 grayscale' : ''
                                        }`}
                                >
                                    {/* Reorder Controls */}
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={index === 0}
                                            onClick={() => moveBanner(index, 'up')}
                                            aria-label="Move up"
                                        >
                                            <MoveUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={index === banners.length - 1}
                                            onClick={() => moveBanner(index, 'down')}
                                            aria-label="Move down"
                                        >
                                            <MoveDown className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Image Preview */}
                                    <div className="relative w-full md:w-48 h-24 rounded-md overflow-hidden bg-muted border">
                                        <img
                                            src={banner.image_url}
                                            alt={banner.heading || 'Banner'}
                                            className="object-cover w-full h-full"
                                            loading="lazy"
                                        />
                                        {!banner.is_active && (
                                            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                                <EyeOff className="h-6 w-6" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 w-full text-center md:text-left">
                                        <h3 className="font-bold">{banner.heading || <span className="text-muted-foreground italic">No Heading</span>}</h3>
                                        {banner.subheading && <p className="text-sm text-muted-foreground">{banner.subheading}</p>}
                                        <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                                            {banner.button_text && (
                                                <Badge variant="outline">{banner.button_text}</Badge>
                                            )}
                                            {banner.button_link && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <LinkIcon className="h-3 w-3" />
                                                    {banner.button_link}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleActive(banner)}
                                            className={banner.is_active ? 'text-green-600' : 'text-muted-foreground'}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(banner)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => { setBannerToDelete(banner); setDeleteDialogOpen(true); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={() => {
                    if (bannerToDelete) {
                        deleteMutation.mutate(bannerToDelete.id);
                        setDeleteDialogOpen(false);
                        setBannerToDelete(null);
                    }
                }}
                itemName={bannerToDelete?.heading || 'this banner'}
                itemType="banner"
                isLoading={deleteMutation.isPending}
            />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingBanner ? 'Edit Banner' : 'Create New Banner'}</DialogTitle>
                        <DialogDescription>
                            Configure the content and link for this banner slide
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                        <div className="space-y-2">
                            <Label>Image URL *</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://example.com/banner.jpg"
                                    value={formData.image_url}
                                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Unsplash or direct image URL</p>
                        </div>

                        {formData.image_url && (
                            <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-muted">
                                <img
                                    src={formData.image_url}
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                    className="w-full h-full object-cover"
                                    alt="Preview"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Heading</Label>
                            <Input
                                placeholder="e.g. Summer Sale"
                                value={formData.heading}
                                onChange={e => setFormData({ ...formData, heading: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Subheading</Label>
                            <Input
                                placeholder="e.g. 20% off all edibles this week"
                                value={formData.subheading}
                                onChange={e => setFormData({ ...formData, subheading: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Button Text</Label>
                                <Input
                                    placeholder="Shop Now"
                                    value={formData.button_text}
                                    onChange={e => setFormData({ ...formData, button_text: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Link URL</Label>
                                <Input
                                    placeholder="/shop/store-name/products"
                                    value={formData.button_link}
                                    onChange={e => setFormData({ ...formData, button_link: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                id="active"
                                checked={formData.is_active}
                                onCheckedChange={c => setFormData({ ...formData, is_active: c })}
                            />
                            <Label htmlFor="active">Banner is visible</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => saveBannerMutation.mutate(formData)}
                            disabled={saveBannerMutation.isPending || !formData.image_url}
                        >
                            {saveBannerMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Save Banner
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
