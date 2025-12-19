import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Search,
  Grid3x3,
  List,
  Trash2,
  Download,
  Image as ImageIcon,
  Tag,
  Filter,
  ArrowLeft
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/queryKeys';
import { Loader2 } from 'lucide-react';

export default function ImagesPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  interface ProductImage {
    id: string;
    name?: string;
    image_url?: string | null;
    created_at?: string;
    [key: string]: unknown;
  }

  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Fetch images from storage
  const { data: images, isLoading } = useQuery({
    queryKey: queryKeys.productImages.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Get all products with images
        const { data, error } = await supabase
          .from('products')
          .select('id, name, image_url, created_at')
          .eq('tenant_id', tenantId)
          .not('image_url', 'is', null);
        
        // Gracefully handle missing table
        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Load products for assignment
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.products.list({ tenantId, forImages: true }),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
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

      // Assign image to product with tenant filter for security
      if (!tenantId) throw new Error('No tenant context');
      
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', selectedProductId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      toast({ title: 'Image uploaded and assigned successfully!' });
      queryClient.invalidateQueries({ queryKey: queryKeys.productImages.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      setUploadDialogOpen(false);
      setSelectedProductId('');
    },
    onError: (error: unknown) => {
      logger.error('Image upload failed', error, { component: 'ImagesPage' });
      toast({ 
        title: 'Upload failed', 
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  // Delete image
  const deleteImage = useMutation({
    mutationFn: async (imageUrl: string) => {
      // Extract file path from URL
      const path = imageUrl.split('/product-images/')[1];
      
      if (!path) throw new Error('Invalid image URL');

      const { error } = await supabase.storage
        .from('product-images')
        .remove([path]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Image deleted successfully!' });
      queryClient.invalidateQueries({ queryKey: queryKeys.productImages.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      setSelectedImage(null);
    },
    onError: (error: unknown) => {
      logger.error('Image deletion failed', error, { component: 'ImagesPage' });
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive'
      });
      return;
    }

    uploadImage.mutate(file);
  };

  const filteredImages = images?.filter(img =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Images & Media</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{images?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total Images</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {Math.round((images?.length || 0) * 2.3)}MB
            </div>
            <p className="text-xs text-muted-foreground">Storage Used</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {images?.filter(i => i.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Added This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">100GB</div>
            <p className="text-xs text-muted-foreground">Storage Limit</p>
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
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images Grid/List */}
      {isLoading ? (
        <div className="text-center py-12">Loading images...</div>
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
                    src={image.image_url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{image.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(image.created_at).toLocaleDateString()}
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
                      src={image.image_url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{image.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Uploaded {new Date(image.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(image.image_url, '_blank');
                    }}
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
              <select
                id="product-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">-- Select a product --</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden">
              <img
                src={selectedImage?.image_url}
                alt={selectedImage?.name}
                className="w-full h-auto"
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
                  {selectedImage && new Date(selectedImage.created_at).toLocaleDateString()}
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
              onClick={() => window.open(selectedImage?.image_url, '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!selectedImage) return;
                try {
                  deleteImage.mutate(selectedImage.image_url);
                } catch (error) {
                  logger.error('Button click error', error, { component: 'ImagesPage' });
                }
              }}
              disabled={!selectedImage || deleteImage.isPending}
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
    </div>
  );
}

