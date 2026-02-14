import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'card' | 'text' | 'chart' | 'stats';
}

export function SkeletonLoader({ className = '', variant = 'card' }: SkeletonLoaderProps) {
  const shimmer = {
    animate: {
      backgroundPosition: ['200% 0', '-200% 0'],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear' as const,
    },
  };

  if (variant === 'card') {
    return (
      <motion.div
        className={`rounded-xl bg-gradient-to-r from-muted via-muted/50 to-muted ${className}`}
        style={{
          backgroundSize: '200% 100%',
        }}
        animate={shimmer.animate}
        transition={shimmer.transition}
      >
        <div className="p-6 space-y-4">
          <div className="h-6 bg-muted-foreground/10 rounded w-3/4" />
          <div className="h-4 bg-muted-foreground/10 rounded w-full" />
          <div className="h-4 bg-muted-foreground/10 rounded w-5/6" />
        </div>
      </motion.div>
    );
  }

  if (variant === 'text') {
    return (
      <motion.div
        className={`h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded ${className}`}
        style={{
          backgroundSize: '200% 100%',
        }}
        animate={shimmer.animate}
        transition={shimmer.transition}
      />
    );
  }

  if (variant === 'chart') {
    return (
      <motion.div
        className={`rounded-xl bg-gradient-to-r from-muted via-muted/50 to-muted ${className}`}
        style={{
          backgroundSize: '200% 100%',
        }}
        animate={shimmer.animate}
        transition={shimmer.transition}
      >
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-muted-foreground/10 rounded"
                style={{ height: `${Math.random() * 100 + 50}px` }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === 'stats') {
    return (
      <motion.div
        className={`rounded-xl bg-gradient-to-r from-muted via-muted/50 to-muted ${className}`}
        style={{
          backgroundSize: '200% 100%',
        }}
        animate={shimmer.animate}
        transition={shimmer.transition}
      >
        <div className="p-8 text-center space-y-3">
          <div className="h-8 w-16 bg-muted-foreground/10 rounded mx-auto" />
          <div className="h-12 w-24 bg-muted-foreground/10 rounded mx-auto" />
          <div className="h-4 w-20 bg-muted-foreground/10 rounded mx-auto" />
        </div>
      </motion.div>
    );
  }

  return null;
}

export function SectionSkeleton() {
  return (
    <div className="py-20 space-y-8 animate-pulse" role="status" aria-busy="true" aria-label="Loading section content">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <div className="h-10 bg-muted rounded w-64 mx-auto" />
          <div className="h-6 bg-muted rounded w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[...Array(6)].map((_, i) => (
            <SkeletonLoader key={i} variant="card" />
          ))}
        </div>
      </div>
    </div>
  );
}
