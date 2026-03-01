import { Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductNotFoundProps {
  /** Store slug for linking back to menu/products */
  storeSlug: string;
  /** Route prefix: "store" for /store/:slug/menu, "shop" for /shop/:slug/products */
  routePrefix?: 'store' | 'shop';
}

export default function ProductNotFound({ storeSlug, routePrefix = 'store' }: ProductNotFoundProps) {
  const backLink = routePrefix === 'shop'
    ? `/shop/${storeSlug}/products`
    : `/store/${storeSlug}/menu`;
  const backLabel = routePrefix === 'shop' ? 'Browse Products' : 'Back to Menu';

  return (
    <div className="flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-lg">
        {/* Icon */}
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-neutral-100 border border-neutral-200">
          <Package className="h-14 w-14 text-neutral-400" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-3">
          Product Not Found
        </h1>

        {/* Description */}
        <p className="text-lg text-neutral-500 mb-2">
          This product may have been removed or is currently unavailable.
        </p>
        <p className="text-sm text-neutral-400 mb-10">
          It might have been taken off the shelf or the link may be outdated.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={backLink}>
            <Button size="lg" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
