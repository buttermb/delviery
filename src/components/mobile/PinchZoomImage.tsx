import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface PinchZoomImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function PinchZoomImage({ src, alt, className }: PinchZoomImageProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number>(0);
  const lastPosition = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan gesture (only when zoomed)
      setIsDragging(true);
      lastPosition.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      };
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (lastTouchDistance.current > 0) {
        const newScale = scale * (distance / lastTouchDistance.current);
        setScale(Math.min(Math.max(1, newScale), 4)); // Limit between 1x and 4x
      }
      
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan
      e.preventDefault();
      const newX = e.touches[0].clientX - lastPosition.current.x;
      const newY = e.touches[0].clientY - lastPosition.current.y;
      
      // Limit panning to image bounds
      const maxMove = (scale - 1) * 150;
      setPosition({
        x: Math.min(Math.max(newX, -maxMove), maxMove),
        y: Math.min(Math.max(newY, -maxMove), maxMove),
      });
    }
  }, [scale, isDragging, position]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDistance.current = 0;
    
    // Reset if zoomed out
    if (scale <= 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  }, [scale]);

  return (
    <div
      ref={imageRef}
      className={cn("relative overflow-hidden touch-none select-none", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-200 ease-out"
        style={{
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
        }}
        draggable={false}
      />
      
      {/* Zoom indicator */}
      {scale > 1 && (
        <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
          {scale.toFixed(1)}x
        </div>
      )}
      
      {/* Hint text */}
      {scale === 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-xs backdrop-blur-sm animate-pulse">
          Pinch to zoom • Double tap to zoom
        </div>
      )}
    </div>
  );
}
