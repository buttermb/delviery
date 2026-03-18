
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Loader2, Plus, FolderTree, Edit2, Trash2 } from "lucide-react";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

type MarketplaceCategory = {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    description: string | null;
    parent_id: string | null;
    display_order: number;
    is_active: boolean;
    image_url: string | null;
    created_at: string;
};

export default function MarketplaceCategoryManager() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MarketplaceCategory | null>(null);
    const [formData, setFormData] = useState<Partial<MarketplaceCategory>>({
        is_active: true,
        display_order: 0
    });

    // Fetch categories
    const { data: categories, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceCategories.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];
            const { data, error } = await supabase
                .from('marketplace_categories')
                .select('id, tenant_id, name, slug, description, parent_id, display_order, is_active, image_url, created_at')
                .eq('tenant_id', tenant.id)
                .order('display_order', { ascending: true });
            if (error) throw error;
            return (data ?? []) as unknown as MarketplaceCategory[];
        },
        enabled: !!tenant?.id
    });

    // Mutations
    const upsertCategory = useMutation({
        mutationFn: async (category: Partial<MarketplaceCategory>) => {
            if (!tenant?.id) throw new Error("No tenant");

            const slug = category.slug ?? category.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? '';
            const payload = {
                ...category,
                tenant_id: tenant.id,
                slug
            };

            if (category.id) {
                const { error } = await supabase
                    .from('marketplace_categories')
                    .update(payload)
                    .eq('id', category.id)
                    .eq('tenant_id', tenant.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('marketplace_categories')
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCategories.all });
            setIsDialogOpen(false);
            setEditingCategory(null);
            setFormData({ is_active: true, display_order: 0 });
            toast.success(editingCategory ? "Category updated" : "Category created");
        },
        onError: (err) => toast.error("Error: " + err.message)
    });

    const deleteCategory = useMutation({
        mutationFn: async (id: string) => {
            if (!tenant?.id) throw new Error("No tenant");
            const { error } = await supabase
                .from('marketplace_categories')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenant.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCategories.all });
            toast.success("Category deleted");
        },
        onError: (error: Error) => {
            logger.error('Failed to delete category', { error });
            toast.error("Failed to delete category", { description: humanizeError(error) });
        },
    });
    
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<MarketplaceCategory | null>(null);

    const handleEdit = (cat: MarketplaceCategory) => {
        setEditingCategory(cat);
        setFormData(cat);
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!formData.name) return toast.error("Name is required");
        upsertCategory.mutate(formData);
    };

    if (isLoading) return <EnhancedLoadingState variant="table" message="Loading categories..." />;

    return (
        <div className="space-y-4 h-full p-4 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Category Manager</h1>
                    <p className="text-muted-foreground mt-1">
                        Organize your products into categories for easier navigation.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingCategory(null);
                        setFormData({ is_active: true, display_order: 0 });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Category
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
                            <DialogDescription>
                                Create a category to group your products.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name ?? ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="slug">Slug (URL)</Label>
                                <Input
                                    id="slug"
                                    value={formData.slug ?? ''}
                                    placeholder="Auto-generated if empty"
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="order">Display Order</Label>
                                <Input
                                    id="order"
                                    type="number"
                                    value={formData.display_order ?? 0}
                                    onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={formData.is_active}
                                    onCheckedChange={c => setFormData({ ...formData, is_active: c })}
                                />
                                <Label>Active</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSave} disabled={upsertCategory.isPending}>
                                {upsertCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Product Categories</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories?.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                                        {cat.name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                                    <TableCell>{cat.display_order}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {cat.is_active ? 'Active' : 'Hidden'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(cat)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setCategoryToDelete(cat);
                                                setDeleteDialogOpen(true);
                                            }}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {categories?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No categories found.
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
                onConfirm={() => categoryToDelete && deleteCategory.mutate(categoryToDelete.id)}
                itemName={categoryToDelete?.name || 'this category'}
                isLoading={deleteCategory.isPending}
            />
        </div>
    );
}
