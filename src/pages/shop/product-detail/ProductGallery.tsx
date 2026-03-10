/**
 * Product Gallery
 * Image carousel with scroll-snap, thumbnails, zoom dialog, and badge overlays
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Heart,
  Share2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  productName: string;
  allImages: string[];
  inStock: boolean;
  stockQuantity: number;
  discountPercent: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
}

export function ProductGallery({
  productName,
  allImages,
  inStock,
  stockQuantity,
  discountPercent,
  isWishlisted,
  onToggleWishlist,
}: ProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [showZoom, setShowZoom] = useState(false);

  const imageScrollRef = useRef<HTMLDivElement>(null);

  const scrollToImage = useCallback((index: number) => {
    const container = imageScrollRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.offsetWidth, behavior: 'smooth' });
  }, []);

  // Sync selectedImage from scroll-snap position
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
          setSelectedImage(Math.max(0, Math.min(index, allImages.length - 1)));
          ticking = false;
        });
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [allImages.length]);

  return (
    <>
      <div className="lg:col-span-7 space-y-6">
        <div
          className="relative aspect-square md:aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-white/5 group border border-white/5 cursor-zoom-in"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* CSS scroll-snap image carousel */}
          <div
            ref={imageScrollRef}
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {allImages.map((img, idx) => (
              <div
                key={idx}
                className="w-full h-full flex-shrink-0 snap-start"
                onClick={() => setShowZoom(true)}
              >
                <img
                  src={img || '/placeholder.png'}
                  alt={`${productName} ${idx + 1}`}
                  className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isHovering ? 'scale-110' : 'scale-100'}`}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>

          {/* Luxury overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />

          <div className="absolute top-4 right-4 z-20 flex flex-col gap-3">
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white"
              onClick={onToggleWishlist}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white"
              aria-label="Share"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            {discountPercent > 0 && (
              <Badge className="bg-red-500/90 hover:bg-red-500 backdrop-blur border-none text-white px-3 py-1 text-xs uppercase tracking-widest">
                Sale
              </Badge>
            )}
            {!inStock && (
              <Badge className="bg-zinc-800/90 text-zinc-300 backdrop-blur border-white/10 px-3 py-1 text-xs uppercase tracking-widest">
                Sold Out
              </Badge>
            )}
            {inStock && stockQuantity < 10 && (
              <Badge className="bg-amber-500/90 text-black backdrop-blur border-none px-3 py-1 text-xs uppercase tracking-widest">
                Low Stock
              </Badge>
            )}
          </div>
        </div>

        {/* Mobile dot indicators */}
        {allImages.length > 1 && (
          <div className="flex sm:hidden justify-center gap-2 mt-3">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => scrollToImage(idx)}
                aria-label={`View image ${idx + 1}`}
                className={cn(
                  'rounded-full transition-all duration-300',
                  selectedImage === idx
                    ? 'w-6 h-2 bg-emerald-400'
                    : 'w-2 h-2 bg-white/30'
                )}
              />
            ))}
          </div>
        )}

        {/* Desktop thumbnails */}
        {allImages.length > 1 && (
          <div className="hidden sm:flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {allImages.map((img, idx) => (
              <button
                key={img}
                onClick={() => scrollToImage(idx)}
                className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden transition-all duration-300 ${selectedImage === idx
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-black scale-105 opacity-100'
                  : 'opacity-50 hover:opacity-80 hover:scale-105'
                  }`}
              >
                <img src={img} alt={`${productName} view ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image Zoom Dialog */}
      <Dialog open={showZoom} onOpenChange={setShowZoom}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0 bg-black/95 border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Product Image</DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center min-h-[80vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white rounded-full"
              onClick={() => setShowZoom(false)}
              aria-label="Close zoom"
            >
              <X className="w-6 h-6" />
            </Button>
            {allImages[selectedImage] && (
              <img
                src={allImages[selectedImage]}
                alt={productName}
                className="max-h-[85vh] w-auto object-contain rounded-lg"
                loading="lazy"
              />
            )}
            {allImages.length > 1 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                {allImages.map((img, index) => (
                  <button
                    key={img}
                    aria-label={`View image ${index + 1}`}
                    className={cn(
                      'w-2.5 h-2.5 rounded-full transition-all duration-300',
                      selectedImage === index ? 'bg-white w-8' : 'bg-white/30 hover:bg-white/50'
                    )}
                    onClick={() => scrollToImage(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
