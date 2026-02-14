import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    width?: number | string;
    height?: number | string;
    className?: string;
    priority?: boolean;
}

export function OptimizedImage({
    src,
    alt,
    width,
    height,
    className,
    priority = false,
    ...props
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (priority) {
            const img = new Image();
            img.src = src;
            img.onload = () => setIsLoaded(true);
            img.onerror = () => setError(true);
        }
    }, [src, priority]);

    return (
        <div
            className={cn("relative overflow-hidden bg-muted/20", className)}
            style={{ width, height }}
        >
            {!isLoaded && !error && (
                <Skeleton className="absolute inset-0 w-full h-full animate-pulse" />
            )}

            <img
                src={src}
                alt={alt}
                width={width}
                height={height}
                loading={priority ? "eager" : "lazy"}
                decoding={priority ? "sync" : "async"}
                onLoad={() => setIsLoaded(true)}
                onError={() => setError(true)}
                className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    isLoaded ? "opacity-100" : "opacity-0",
                    className
                )}
                {...props}
            />

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs">
                    Failed to load
                </div>
            )}
        </div>
    );
}
