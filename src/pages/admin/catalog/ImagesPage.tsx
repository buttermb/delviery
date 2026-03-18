import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Search,
  Grid3x3,
  List,
  Trash2,
  Download,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { formatSmartDate } from '@/lib/formatters';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

interface ProductImage {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string | null;
}

export default function ImagesPage() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Fetch images from storage
  const { data: images, isLoading } = useQuery({
    queryKey: queryKeys.productImages.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, image_url, created_at')
          .eq('tenant_id', tenantId)
          .not('image_url', 'is', null);

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return (data ?? []) as ProductImage[];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as Record<string, unknown>).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
    retry: 2,
  });

  // Load products for assignment
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.products.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
    retry: 2,
  });

  // Upload image
  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!tenantId) throw new Error('Tenant ID missing');
      if (!selectedProductId) throw new Error('Please select a product');

      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', selectedProductId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      toast.success('Image uploaded and assigned successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.productImages.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      setUploadDialogOpen(false);
      setSelectedProductId('');
    },
    onError: (error: unknown) => {
      logger.error('Image upload failed', error, { component: 'ImagesPage', tenantId });
      toast.error('Upload failed', { description: humanizeError(error) });
    },
  });

  // Delete image (from storage AND clear product reference)
  const deleteImage = useMutation({
    mutationFn: async ({ imageUrl, productId }: { imageUrl: string; productId: string }) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      // Extract file path from URL
      const path = imageUrl.split('/product-images/')[1];
      if (!path) throw new Error('Invalid image URL');

      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove([path]);

      if (storageError) throw storageError;

      // Clear the product's image_url reference
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: null })
        .eq('id', productId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Image deleted successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.productImages.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      setSelectedImage(null);
    },
    onError: (error: unknown) => {
      logger.error('Image deletion failed', error, { component: 'ImagesPage', tenantId });
      toast.error('Delete failed', { description: humanizeError(error) });
    },
  });

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maximum file size is 5MB');
      return;
    }

    uploadImage.mutate(file);
  };

  const handleDeleteImage = (image: ProductImage) => {
    if (!image.image_url) return;
    confirm({
      title: 'Delete Image',
      description: `Are you sure you want to delete the image for "${image.name}"? This action cannot be undone.`,
      itemName: image.name,
      itemType: 'image',
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteImage.mutateAsync({ imageUrl: image.image_url!, productId: image.id });
        } finally {
          setLoading(false);
          closeDialog();
        }
      },
    });
  };

  const filteredImages = images?.filter(img =>
    (img.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addedThisWeek = images?.filter(i => {
    if (!i.created_at) return false;
    return i.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }).length ?? 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToAdmin('inventory-hub')}
            className="mb-2"
            aria-label="Back to inventory"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Images & Media</h1>
          <p className="text-muted-foreground">
            Manage product images and media files
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Image
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{images?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total Images</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{addedThisWeek}</div>
            <p className="text-xs text-muted-foreground">Added This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search images"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={view === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setView('grid')}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setView('list')}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images Grid/List */}
      {isLoading ? (
        <EnhancedLoadingState variant="grid" count={6} message="Loading images..." />
      ) : filteredImages?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No images found</p>
            <Button className="mt-4" onClick={() => setUploadDialogOpen(true)}>
              Upload Your First Image
            </Button>
          </CardContent>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages?.map((image) => (
            <Card
              key={image.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedImage(image)}
            >
              <CardContent className="p-0">
                <div className="aspect-square relative overflow-hidden rounded-t-lg">
                  <img
                    src={image.image_url ?? undefined}
                    alt={image.name ?? 'Product image'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{image.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSmartDate(image.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredImages?.map((image) => (
                <div
                  key={image.id}
                  className="flex items-center gap-4 p-4 hover:bg-accent cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={image.image_url ?? undefined}
                      alt={image.name ?? 'Product image'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{image.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Uploaded {formatSmartDate(image.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (image.image_url) {
                        window.open(image.image_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    aria-label={`Download ${image.name}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-select">Select Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="-- Select a product --" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="image-upload">Select Image</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadImage.isPending || !selectedProductId}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden">
              <img
                src={selectedImage?.image_url ?? undefined}
                alt={selectedImage?.name ?? 'Product image'}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Product</p>
                <p className="font-medium">{selectedImage?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Uploaded</p>
                <p className="font-medium">
                  {selectedImage && formatSmartDate(selectedImage.created_at)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">URL</p>
                <p className="font-medium text-xs truncate">{selectedImage?.image_url}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              aria-label="Download image"
              onClick={() => {
                if (selectedImage?.image_url) {
                  window.open(selectedImage.image_url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="destructive"
              aria-label="Delete image"
              onClick={() => {
                if (selectedImage) {
                  handleDeleteImage(selectedImage);
                }
              }}
              disabled={!selectedImage || !selectedImage.image_url || deleteImage.isPending}
            >
              {deleteImage.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
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
