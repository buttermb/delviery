import { useState, useEffect } from 'react';

export function useResponsiveImage(src: string, sizes: { mobile: number; tablet: number; desktop: number }) {
  const [imageSrc, setImageSrc] = useState('');
  
  useEffect(() => {
    const width = window.innerWidth;
    const size = width < 768 ? sizes.mobile : width < 1024 ? sizes.tablet : sizes.desktop;
    
    // Append size query param if using CDN
    const optimizedSrc = src.includes('?') ? `${src}&w=${size}` : `${src}?w=${size}`;
    setImageSrc(optimizedSrc);
  }, [src, sizes]);
  
  return imageSrc;
}
