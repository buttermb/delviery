import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  effect?: 'blur' | 'opacity' | 'black-and-white';
  placeholder?: string;
}

export function LazyImage({ 
  src, 
  alt, 
  className, 
  wrapperClassName,
  effect = 'blur',
  placeholder 
}: LazyImageProps) {
  return (
    <LazyLoadImage
      src={src}
      alt={alt}
      effect={effect}
      className={cn('object-cover', className)}
      wrapperClassName={wrapperClassName}
      placeholderSrc={placeholder}
    />
  );
}
