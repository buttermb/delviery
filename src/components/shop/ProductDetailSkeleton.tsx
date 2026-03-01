/**
 * ProductDetailSkeleton
 * Loading skeleton that matches the product detail page layout
 */

import { Skeleton } from '@/components/ui/skeleton';

export function ProductDetailSkeleton() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-white">
      <div className="relative z-10 pt-16 sm:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 mb-4 sm:mb-8">
            <Skeleton className="h-4 w-12 bg-white/5" />
            <Skeleton className="h-3 w-3 bg-white/5 rounded-full" />
            <Skeleton className="h-4 w-10 bg-white/5" />
            <Skeleton className="h-3 w-3 bg-white/5 rounded-full" />
            <Skeleton className="h-4 w-32 bg-white/5" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12 lg:gap-20">
            {/* Left Column: Image Gallery (Span 7) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Main Image */}
              <Skeleton className="aspect-square md:aspect-[4/3] w-full rounded-2xl sm:rounded-3xl bg-white/5" />

              {/* Thumbnails (desktop only) */}
              <div className="hidden sm:flex gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="w-24 h-24 rounded-2xl bg-white/5 flex-shrink-0" />
                ))}
              </div>

              {/* Dot indicators (mobile only) */}
              <div className="flex sm:hidden justify-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="w-2 h-2 rounded-full bg-white/5" />
                ))}
              </div>
            </div>

            {/* Right Column: Details (Span 5) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 backdrop-blur-xl bg-white/5 border border-white/10 space-y-6">
                {/* Brand & Rating */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20 bg-white/5" />
                    <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-4 w-4 bg-white/5 rounded" />
                    <Skeleton className="h-4 w-8 bg-white/5" />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Skeleton className="h-8 sm:h-12 w-full bg-white/5" />
                  <Skeleton className="h-8 sm:h-12 w-2/3 bg-white/5" />
                </div>

                {/* Short Description */}
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-4 w-4/5 bg-white/5" />
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-4">
                  <Skeleton className="h-8 w-24 bg-white/5" />
                  <Skeleton className="h-5 w-16 bg-white/5" />
                </div>

                {/* THC/CBD Badges */}
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-24 rounded-lg bg-white/5" />
                  <Skeleton className="h-10 w-24 rounded-lg bg-white/5" />
                </div>

                {/* Stock Status */}
                <div className="flex items-center gap-2">
                  <Skeleton className="w-2 h-2 rounded-full bg-white/5" />
                  <Skeleton className="h-4 w-16 bg-white/5" />
                </div>

                {/* Separator */}
                <Skeleton className="h-px w-full bg-white/10" />

                {/* Quantity + Add to Cart */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <Skeleton className="h-12 w-32 rounded-xl bg-white/5" />
                  <Skeleton className="h-12 sm:h-14 flex-1 rounded-xl bg-white/5" />
                </div>

                {/* Effects Badges */}
                <div className="pt-6 border-t border-white/10">
                  <div className="flex flex-wrap gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <Skeleton className="w-10 h-10 rounded-full bg-white/5" />
                        <Skeleton className="h-3 w-12 bg-white/5" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust Indicators */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <Skeleton className="w-8 h-8 rounded-full bg-white/5" />
                      <Skeleton className="h-2.5 w-16 bg-white/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Description/Reviews Tabs Section */}
          <div className="mt-12 sm:mt-24">
            <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-12 bg-white/5 border border-white/10 backdrop-blur-md">
              {/* Tab Headers */}
              <div className="flex gap-4 sm:gap-8 border-b border-white/10 pb-4 mb-6 sm:mb-8">
                <Skeleton className="h-6 w-28 bg-white/5" />
                <Skeleton className="h-6 w-24 bg-white/5" />
              </div>
              {/* Tab Content */}
              <div className="space-y-3">
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-5/6 bg-white/5" />
              </div>
            </div>
          </div>

          {/* Related Products */}
          <div className="mt-12 sm:mt-24">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <Skeleton className="h-8 w-48 bg-white/5" />
              <Skeleton className="h-5 w-16 bg-white/5" />
            </div>
            <div className="flex overflow-x-auto gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-visible">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[65vw] sm:w-auto rounded-2xl overflow-hidden bg-white/5 border border-white/5">
                  <Skeleton className="aspect-[4/5] w-full bg-white/5" />
                  <div className="p-3 sm:p-5 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-white/5" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-16 bg-white/5" />
                      <Skeleton className="h-4 w-14 bg-white/5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
