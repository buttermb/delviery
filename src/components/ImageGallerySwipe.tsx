import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { haptics } from '@/utils/haptics';

interface ImageGallerySwipeProps {
  images: string[];
  alt: string;
}

export function ImageGallerySwipe({ images, alt }: ImageGallerySwipeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(i => i + 1);
      haptics.light();
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      haptics.light();
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: goToNext,
    onSwipedRight: goToPrev,
    trackMouse: true,
    trackTouch: true,
  });

  if (images.length === 0) return null;

  return (
    <div {...handlers} className="relative w-full aspect-square overflow-hidden rounded-lg bg-muted">
      <div
        className="flex transition-transform duration-300 ease-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((image, index) => (
          <img
            key={index}
            src={image}
            alt={`${alt} - Image ${index + 1}`}
            className="w-full h-full object-cover flex-shrink-0"
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          {/* Navigation buttons */}
          {currentIndex > 0 && (
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {currentIndex < images.length - 1 && (
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Dots indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentIndex(i);
                  haptics.selection();
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-white w-6'
                    : 'bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
