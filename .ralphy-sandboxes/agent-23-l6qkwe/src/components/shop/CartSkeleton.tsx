import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Skeleton placeholder for a single cart item row.
 * Mirrors the image + product info + quantity controls layout.
 */
function CartItemSkeleton() {
  return (
    <div className="flex gap-3 sm:gap-4">
      {/* Product image */}
      <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg" />
      <div className="flex-1 min-w-0 space-y-2">
        {/* Product name */}
        <Skeleton className="h-4 w-3/4" />
        {/* Variant */}
        <Skeleton className="h-3 w-1/3" />
        {/* Price */}
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Desktop quantity controls */}
      <div className="hidden sm:flex flex-col items-end gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  );
}

interface CartSkeletonProps {
  /** Number of cart item rows to render */
  itemCount?: number;
}

/**
 * Full-page skeleton matching the CartPage layout:
 * - Page title
 * - 3-column grid: cart items (2 cols) + order summary (1 col)
 * - Free delivery progress bar
 * - Cart items with image, name, controls
 * - Order summary with coupon, totals, buttons
 * - Upsells row
 */
export function CartSkeleton({ itemCount = 3 }: CartSkeletonProps) {
  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Page title */}
      <Skeleton className="h-8 w-48 mb-4 sm:mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Left column — Cart Items */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Free delivery progress */}
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="w-full h-1.5 rounded-full" />
            </CardContent>
          </Card>

          {/* Cart items card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-20 rounded" />
            </CardHeader>
            <CardContent className="space-y-6 px-3 sm:px-6">
              {Array.from({ length: itemCount }).map((_, i) => (
                <CartItemSkeleton key={i} />
              ))}
            </CardContent>
          </Card>

          {/* Upsells — "You Might Also Like" */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-40 flex-shrink-0">
                    <Skeleton className="h-40 w-full rounded-lg mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Order Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coupon input */}
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Skeleton className="h-10 w-16 rounded-md" />
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>

              {/* Checkout button */}
              <Skeleton className="h-11 w-full rounded-md" />
              {/* Express checkout */}
              <Skeleton className="h-10 w-full rounded-md" />
              {/* Continue shopping */}
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
