/**
 * Product Image Gallery Component
 * Uses CSS scroll-snap for native swipe/scroll behavior
 * Supports multiple images with thumbnails and zoom
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { OptimizedProductImage } from '@/components/OptimizedProductImage';

interface ProductImage {
  id?: string;
  url: string;
  sizes?: {
    thumb?: string;
    medium?: string;
    large?: string;
    full?: string;
  };
  is_primary?: boolean;
}

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
  onZoom?: (imageUrl: string) => void;
}

export function ProductImageGallery({ images, productName, onZoom }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter and process images
  const processedImages = images
    .filter(img => img.url || img.sizes?.medium)
    .map(img => ({
      ...img,
      thumb: img.sizes?.thumb || img.url,
      medium: img.sizes?.medium || img.url,
      large: img.sizes?.large || img.url,
      full: img.sizes?.full || img.url,
    }));

  // Sync selectedIndex when scroll snaps to a new image
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const index = Math.round(scrollLeft / width);
    setSelectedIndex(Math.max(0, Math.min(index, processedImages.length - 1)));
  }, [processedImages.length]);

  // Debounce scroll handler for performance
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  const scrollToIndex = useCallback((index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      left: index * container.offsetWidth,
      behavior: 'smooth',
    });
  }, []);

  if (processedImages.length === 0) {
    return (
      <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No images available</span>
      </div>
    );
  }

  const currentImage = processedImages[selectedIndex];
  const hasMultiple = processedImages.length > 1;

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = selectedIndex === 0 ? processedImages.length - 1 : selectedIndex - 1;
    scrollToIndex(newIndex);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = selectedIndex === processedImages.length - 1 ? 0 : selectedIndex + 1;
    scrollToIndex(newIndex);
  };

  const handleImageClick = () => {
    setShowZoom(true);
    if (onZoom) {
      onZoom(currentImage.full || currentImage.url);
    }
  };

  const handleThumbnailClick = (index: number) => {
    scrollToIndex(index);
  };

  return (
    <>
      {/* Main Image Display */}
      <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden group">
        {/* Scroll-snap carousel */}
        <div
          ref={scrollContainerRef}
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {processedImages.map((img, index) => (
            <div
              key={img.id || index}
              className="w-full h-full flex-shrink-0 snap-start cursor-pointer"
              onClick={handleImageClick}
            >
              <OptimizedProductImage
                src={img.medium || img.url}
                alt={`${productName} - Image ${index + 1}`}
                className="w-full h-full object-cover"
                priority={index === 0}
              />
            </div>
          ))}
        </div>

        {/* Zoom Indicator */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/50 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
            <ZoomIn className="h-4 w-4" />
            <span>Tap to zoom</span>
          </div>
        </div>

        {/* Image Counter */}
        {hasMultiple && (
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm pointer-events-none">
            {selectedIndex + 1} / {processedImages.length}
          </div>
        )}

        {/* Navigation Arrows */}
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handlePrevious}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleNext}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Primary Badge */}
        {currentImage.is_primary && (
          <div className="absolute bottom-4 left-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold pointer-events-none">
            Primary
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {hasMultiple && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {processedImages.map((img, index) => (
            <button
              key={index}
              onClick={() => handleThumbnailClick(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                index === selectedIndex
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <OptimizedProductImage
                src={img.thumb || img.url}
                alt={`${productName} thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Dialog */}
      <Dialog open={showZoom} onOpenChange={setShowZoom}>
        <DialogContent className="max-w-7xl w-[95vw] h-[95vh] p-0 bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setShowZoom(false)}
              aria-label="Close zoom"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Full Size Image */}
            <div className="w-full h-full flex items-center justify-center p-4">
              <OptimizedProductImage
                src={currentImage.full || currentImage.large || currentImage.url}
                alt={`${productName} - Full size`}
                className="max-w-full max-h-full object-contain"
                priority={true}
              />
            </div>

            {/* Navigation in Zoom */}
            {hasMultiple && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={handlePrevious}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={handleNext}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>

                {/* Image Counter in Zoom */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full">
                  {selectedIndex + 1} / {processedImages.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
