/**
 * MenuItemImageGallery Component
 * Task 292: Add menu item image gallery
 *
 * Image gallery for menu items with lightbox and thumbnails
 */

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import X from 'lucide-react/dist/esm/icons/x';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in';
import Image from 'lucide-react/dist/esm/icons/image';

interface MenuItemImageGalleryProps {
  images: string[];
  alt?: string;
  className?: string;
}

export function MenuItemImageGallery({ images, alt = 'Product image', className }: MenuItemImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className={cn('aspect-square bg-muted flex items-center justify-center rounded-lg', className)}>
        <Image className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const nextImage = () => {
    if (lightboxIndex < images.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const prevImage = () => {
    if (lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  return (
    <>
      <div className={cn('space-y-3', className)}>
        {/* Main Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted group">
          <img
            src={images[selectedIndex]}
            alt={alt}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <button
            onClick={() => openLightbox(selectedIndex)}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="bg-white rounded-full p-3">
              <ZoomIn className="h-6 w-6 text-gray-900" />
            </div>
          </button>
          {images.length > 1 && (
            <Badge
              variant="secondary"
              className="absolute top-3 right-3 bg-black/50 text-white border-none"
            >
              {selectedIndex + 1} / {images.length}
            </Badge>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'aspect-square rounded overflow-hidden border-2 transition-all',
                  selectedIndex === index
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-muted-foreground/30'
                )}
              >
                <img
                  src={image}
                  alt={`${alt} ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Image Counter */}
            <Badge
              variant="secondary"
              className="absolute top-4 left-4 z-50 bg-white/10 text-white border-none backdrop-blur"
            >
              {lightboxIndex + 1} / {images.length}
            </Badge>

            {/* Navigation Buttons */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevImage}
                  disabled={lightboxIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextImage}
                  disabled={lightboxIndex === images.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Main Image */}
            <img
              src={images[lightboxIndex]}
              alt={`${alt} ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
                <div className="flex gap-2 bg-black/50 backdrop-blur rounded-lg p-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setLightboxIndex(index)}
                      className={cn(
                        'w-16 h-16 rounded overflow-hidden border-2 transition-all',
                        lightboxIndex === index
                          ? 'border-white ring-2 ring-white/50'
                          : 'border-white/20 hover:border-white/50 opacity-60 hover:opacity-100'
                      )}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
