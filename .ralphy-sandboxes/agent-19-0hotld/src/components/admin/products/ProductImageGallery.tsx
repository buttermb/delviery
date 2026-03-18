/**
 * ProductImageGallery Component
 *
 * Displays product images with gallery view, drag-to-reorder,
 * and preview of how product appears on menus/storefronts.
 *
 * Features:
 * - Multiple images per product with drag-to-reorder
 * - Primary image designation (shown in lists and menus)
 * - Preview how product appears on disposable menu and storefront
 * - Image optimization for web display
 * - Lazy loading in lists
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { humanizeError } from '@/lib/humanizeError';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { OptimizedProductImage } from '@/components/OptimizedProductImage';

import ImageIcon from 'lucide-react/dist/esm/icons/image';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import Star from 'lucide-react/dist/esm/icons/star';
import X from 'lucide-react/dist/esm/icons/x';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Monitor from 'lucide-react/dist/esm/icons/monitor';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import Store from 'lucide-react/dist/esm/icons/store';
import Menu from 'lucide-react/dist/esm/icons/menu';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Package from 'lucide-react/dist/esm/icons/package';

export interface ProductImageData {
  id: string;
  name: string;
  image_url: string | null;
  images: string[] | null;
  category?: string | null;
  strain_type?: string | null;
  retail_price?: number | null;
  wholesale_price?: number | null;
  description?: string | null;
  thc_percent?: number | null;
  cbd_percent?: number | null;
}

interface ProductImageGalleryProps {
  product: ProductImageData;
  /**
   * Whether to show controls (reorder, set primary, remove)
   * Set to false for read-only display
   */
  editable?: boolean;
  /**
   * Show menu/storefront preview buttons
   */
  showPreview?: boolean;
  /**
   * Custom class name for the container
   */
  className?: string;
}

type PreviewMode = 'menu' | 'storefront';
type DevicePreview = 'desktop' | 'mobile';

/**
 * ProductImageGallery - Admin component for managing product images
 *
 * Features:
 * - Gallery view with thumbnails
 * - Drag-to-reorder images
 * - Set primary image
 * - Preview on menu and storefront
 * - Lazy loading support
 */
export function ProductImageGallery({
  product,
  editable = true,
  showPreview = true,
  className,
}: ProductImageGalleryProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('menu');
  const [devicePreview, setDevicePreview] = useState<DevicePreview>('desktop');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  // Combine primary image and additional images - memoized to stabilize deps
  const allImages = useMemo(() => {
    const images: string[] = [];
    if (product.image_url) {
      images.push(product.image_url);
    }
    if (product.images && Array.isArray(product.images)) {
      // Filter out the primary image if it's also in the images array
      const additionalImages = product.images.filter(
        (img) => img !== product.image_url
      );
      images.push(...additionalImages);
    }
    return images;
  }, [product.image_url, product.images]);

  const hasImages = allImages.length > 0;
  const hasMultiple = allImages.length > 1;
  const currentImage = allImages[selectedIndex] || null;

  // Mutation to update product images
  const updateImagesMutation = useMutation({
    mutationFn: async ({
      imageUrl,
      images,
    }: {
      imageUrl: string | null;
      images: string[];
    }) => {
      if (!tenant?.id || !product.id) {
        throw new Error('Missing tenant or product ID');
      }

      const { error } = await supabase
        .from('products')
        .update({
          image_url: imageUrl,
          images: images,
        })
        .eq('id', product.id)
        .eq('tenant_id', tenant.id);

      if (error) {
        throw error;
      }

      logger.debug('Product images updated', {
        productId: product.id,
        imageUrl,
        imagesCount: images.length,
        component: 'ProductImageGallery',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success("Images updated successfully");
    },
    onError: (error) => {
      logger.error('Failed to update product images', error as Error, {
        component: 'ProductImageGallery',
      });
      toast.error("Failed to update images", { description: humanizeError(error) });
    },
  });

  // Set image as primary
  const handleSetPrimary = useCallback(
    (index: number) => {
      if (index === 0 || !editable) return; // Already primary or not editable

      const newPrimary = allImages[index];
      const newImages = allImages.filter((_, i) => i !== index);
      // Move old primary to additional images if exists
      if (allImages[0]) {
        newImages.unshift(allImages[0]);
      }

      updateImagesMutation.mutate({
        imageUrl: newPrimary,
        images: newImages.slice(1), // Exclude the new primary from additional
      });
      setSelectedIndex(0);
    },
    [allImages, editable, updateImagesMutation]
  );

  // Remove image
  const handleRemoveImage = useCallback(
    (index: number) => {
      if (!editable) return;

      const newImages = allImages.filter((_, i) => i !== index);
      const newPrimary = newImages[0] || null;
      const additionalImages = newImages.slice(1);

      updateImagesMutation.mutate({
        imageUrl: newPrimary,
        images: additionalImages,
      });

      // Adjust selected index if needed
      if (selectedIndex >= newImages.length) {
        setSelectedIndex(Math.max(0, newImages.length - 1));
      }
    },
    [allImages, editable, selectedIndex, updateImagesMutation]
  );

  // Reorder images via drag and drop
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!editable) return;
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
    },
    [editable]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === targetIndex || !editable) {
        setDraggedIndex(null);
        return;
      }

      const newImages = [...allImages];
      const [draggedImage] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, draggedImage);

      const newPrimary = newImages[0];
      const additionalImages = newImages.slice(1);

      updateImagesMutation.mutate({
        imageUrl: newPrimary,
        images: additionalImages,
      });

      setDraggedIndex(null);
    },
    [allImages, draggedIndex, editable, updateImagesMutation]
  );

  // Scroll-snap navigation
  const scrollToImage = useCallback((index: number) => {
    const container = imageScrollRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.offsetWidth, behavior: 'smooth' });
  }, []);

  const handlePrevious = useCallback(() => {
    const newIndex = selectedIndex === 0 ? allImages.length - 1 : selectedIndex - 1;
    scrollToImage(newIndex);
  }, [allImages.length, selectedIndex, scrollToImage]);

  const handleNext = useCallback(() => {
    const newIndex = selectedIndex === allImages.length - 1 ? 0 : selectedIndex + 1;
    scrollToImage(newIndex);
  }, [allImages.length, selectedIndex, scrollToImage]);

  // Sync selectedIndex from scroll position
  useEffect(() => {
    const container = imageScrollRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const scrollLeft = container.scrollLeft;
          const width = container.offsetWidth;
          const index = Math.round(scrollLeft / width);
          setSelectedIndex(Math.max(0, Math.min(index, allImages.length - 1)));
          ticking = false;
        });
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [allImages.length]);

  const isUpdating = updateImagesMutation.isPending;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Image Gallery
            </CardTitle>
            <CardDescription>
              {allImages.length} image{allImages.length !== 1 ? 's' : ''} •
              {editable && ' Drag to reorder •'} Click to zoom
            </CardDescription>
          </div>
          {showPreview && hasImages && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewDialog(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Image Display — CSS scroll-snap carousel */}
        {hasImages ? (
          <div className="relative group">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <div
                ref={imageScrollRef}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide cursor-pointer"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                onClick={() => setShowZoom(true)}
              >
                {allImages.map((img, index) => (
                  <div key={`slide-${index}`} className="w-full h-full flex-shrink-0 snap-start">
                    <OptimizedProductImage
                      src={img}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full"
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>

              {/* Primary badge */}
              {selectedIndex === 0 && (
                <Badge className="absolute top-3 left-3 bg-amber-500 hover:bg-amber-600 pointer-events-none">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Primary
                </Badge>
              )}

              {/* Image counter */}
              {hasMultiple && (
                <div className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1 rounded-full text-sm pointer-events-none">
                  {selectedIndex + 1} / {allImages.length}
                </div>
              )}

              {/* Zoom indicator */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                <div className="bg-white/90 rounded-full p-3">
                  <ZoomIn className="h-6 w-6 text-gray-700" />
                </div>
              </div>
            </div>

            {/* Navigation arrows */}
            {hasMultiple && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 rounded-full shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 rounded-full shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="aspect-square rounded-lg bg-muted flex flex-col items-center justify-center text-muted-foreground">
            <Package className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-sm font-medium">No images</p>
            <p className="text-xs mt-1">Upload images to display them here</p>
          </div>
        )}

        {/* Thumbnail Grid */}
        {hasMultiple && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {allImages.map((img, index) => (
              <div
                key={`thumb-${index}`}
                draggable={editable}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  'relative flex-shrink-0 group/thumb',
                  draggedIndex === index && 'opacity-50'
                )}
              >
                <button
                  onClick={() => scrollToImage(index)}
                  className={cn(
                    'w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                    index === selectedIndex
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-muted-foreground/30'
                  )}
                >
                  <OptimizedProductImage
                    src={img}
                    alt={`${product.name} thumbnail ${index + 1}`}
                    className="w-full h-full"
                  />
                </button>

                {/* Drag handle */}
                {editable && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                    <div className="bg-black/60 rounded p-0.5">
                      <GripVertical className="h-3 w-3 text-white" />
                    </div>
                  </div>
                )}

                {/* Primary indicator */}
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                    <Star className="h-2.5 w-2.5 text-white fill-current" />
                  </div>
                )}

                {/* Action overlay on hover */}
                {editable && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-lg">
                    {index !== 0 && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrimary(index);
                        }}
                        disabled={isUpdating}
                        title="Set as primary"
                        aria-label="Set as primary image"
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      disabled={isUpdating}
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Updating indicator */}
        {isUpdating && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating images...
          </div>
        )}
      </CardContent>

      {/* Zoom Dialog */}
      <Dialog open={showZoom} onOpenChange={setShowZoom}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setShowZoom(false)}
              aria-label="Close zoom"
            >
              <X className="h-6 w-6" />
            </Button>

            {currentImage && (
              <img
                src={currentImage}
                alt={`${product.name} - Full size`}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            )}

            {hasMultiple && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                  onClick={handlePrevious}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                  onClick={handleNext}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full">
                  {selectedIndex + 1} / {allImages.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview: How this product appears
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode and device toggles */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <Tabs
                value={previewMode}
                onValueChange={(v) => setPreviewMode(v as PreviewMode)}
              >
                <TabsList>
                  <TabsTrigger value="menu" className="gap-2">
                    <Menu className="h-4 w-4" />
                    Disposable Menu
                  </TabsTrigger>
                  <TabsTrigger value="storefront" className="gap-2">
                    <Store className="h-4 w-4" />
                    Storefront
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center border rounded-lg p-1 gap-1">
                <Button
                  variant={devicePreview === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDevicePreview('desktop')}
                  className="h-11 w-11 p-0"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={devicePreview === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDevicePreview('mobile')}
                  className="h-11 w-11 p-0"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Preview container */}
            <div className="bg-muted rounded-lg p-4 flex justify-center overflow-auto max-h-[60vh]">
              <div
                className={cn(
                  'bg-background rounded-lg shadow-xl transition-all duration-300',
                  devicePreview === 'mobile' ? 'w-[375px]' : 'w-full max-w-lg'
                )}
              >
                <ProductPreviewCard
                  product={product}
                  imageUrl={product.image_url}
                  mode={previewMode}
                  isMobile={devicePreview === 'mobile'}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              This preview shows how the primary image appears in {previewMode === 'menu' ? 'disposable menus' : 'your storefront'}.
              Customers will see the full gallery on the product detail page.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Internal component for preview card display
 */
interface ProductPreviewCardProps {
  product: ProductImageData;
  imageUrl: string | null;
  mode: PreviewMode;
  isMobile: boolean;
}

function ProductPreviewCard({
  product,
  imageUrl,
  mode,
  isMobile,
}: ProductPreviewCardProps) {
  const formatPrice = (price: number | null | undefined) => {
    if (price == null) return '-';
    return formatCurrency(price);
  };

  if (mode === 'menu') {
    // Disposable Menu Card Style
    return (
      <div className="overflow-hidden">
        <div className="relative aspect-square bg-muted">
          {imageUrl ? (
            <OptimizedProductImage
              src={imageUrl}
              alt={product.name}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground opacity-30" />
            </div>
          )}
          {product.category && (
            <Badge className="absolute top-3 left-3 capitalize">
              {product.category}
            </Badge>
          )}
        </div>
        <div className={cn('p-4 space-y-2', isMobile && 'p-3')}>
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('font-semibold', isMobile ? 'text-base' : 'text-lg')}>
              {product.name}
            </h3>
            {product.strain_type && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs capitalize flex-shrink-0',
                  product.strain_type === 'indica' && 'border-purple-500 text-purple-500',
                  product.strain_type === 'sativa' && 'border-green-500 text-green-500',
                  product.strain_type === 'hybrid' && 'border-orange-500 text-orange-500',
                  product.strain_type === 'cbd' && 'border-blue-500 text-blue-500'
                )}
              >
                {product.strain_type}
              </Badge>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}
          {(product.thc_percent || product.cbd_percent) && (
            <div className="flex gap-2">
              {product.thc_percent != null && (
                <Badge variant="secondary" className="text-xs">
                  THC {product.thc_percent}%
                </Badge>
              )}
              {product.cbd_percent != null && (
                <Badge variant="secondary" className="text-xs">
                  CBD {product.cbd_percent}%
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xl font-bold text-primary">
              {formatPrice(product.retail_price)}
            </span>
            <Button size="sm" disabled className="opacity-70">
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Storefront Card Style
  return (
    <div className="overflow-hidden group">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {imageUrl ? (
          <OptimizedProductImage
            src={imageUrl}
            alt={product.name}
            className="w-full h-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {product.strain_type && (
          <Badge className="absolute top-3 left-3 capitalize bg-black/60">
            {product.strain_type}
          </Badge>
        )}
      </div>
      <div className={cn('p-4 space-y-3', isMobile && 'p-3 space-y-2')}>
        <div>
          <h3 className={cn('font-semibold', isMobile ? 'text-base' : 'text-lg')}>
            {product.name}
          </h3>
          {product.category && (
            <p className="text-sm text-muted-foreground capitalize">
              {product.category}
            </p>
          )}
        </div>
        {(product.thc_percent || product.cbd_percent) && (
          <div className="flex gap-2 flex-wrap">
            {product.thc_percent != null && (
              <span className="text-xs px-2 py-1 bg-muted rounded">
                THC {product.thc_percent}%
              </span>
            )}
            {product.cbd_percent != null && (
              <span className="text-xs px-2 py-1 bg-muted rounded">
                CBD {product.cbd_percent}%
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <div>
            <span className="text-lg font-bold text-primary">
              {formatPrice(product.retail_price)}
            </span>
            {product.wholesale_price && (
              <span className="text-xs text-muted-foreground block">
                Wholesale: {formatPrice(product.wholesale_price)}
              </span>
            )}
          </div>
          <Button size={isMobile ? 'sm' : 'default'} disabled className="opacity-70">
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for ProductImageGallery
 */
export function ProductImageGallerySkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="aspect-square rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="w-16 h-16 rounded-lg" />
          <Skeleton className="w-16 h-16 rounded-lg" />
          <Skeleton className="w-16 h-16 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
