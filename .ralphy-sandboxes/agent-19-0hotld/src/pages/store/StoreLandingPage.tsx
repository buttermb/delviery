/**
 * Public Store Landing Page
 * /store/:slug - No auth required
 * Hero banner, featured products, category cards
 * Mobile-first responsive cannabis dispensary design
 */

import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Leaf, ArrowRight, MapPin, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { Badge } from '@/components/ui/badge';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import StoreNotFound from '@/components/shop/StoreNotFound';
import {
  useStorefrontPageData,
  type StorefrontStoreData,
  type StorefrontProduct,
  type StorefrontCategory,
} from '@/hooks/useStorefrontPageData';

function isStoreOpen(hours: StorefrontStoreData['operating_hours'] | undefined): boolean {
  if (!hours) return true;
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dayHours = hours[dayName];
  if (!dayHours || dayHours.closed) return false;
  const currentTime = now.toTimeString().slice(0, 5);
  return currentTime >= dayHours.open && currentTime <= dayHours.close;
}

export default function StoreLandingPage() {
  const { slug } = useParams<{ slug: string }>();

  // Single query: store + featured products + categories
  const { data: pageData, isLoading, error } = useStorefrontPageData(slug, 'landing');

  const store = pageData?.store ?? null;
  const featuredProducts = pageData?.products ?? [];
  const categories = pageData?.categories ?? [];

  // SEO: Update page title
  useEffect(() => {
    if (store?.store_name) {
      document.title = store.tagline
        ? `${store.store_name} - ${store.tagline}`
        : `${store.store_name} | Cannabis Delivery`;
    }
    return () => {
      document.title = 'FloraIQ';
    };
  }, [store?.store_name, store?.tagline]);

  const primaryColor = store?.theme_config?.colors?.primary || store?.primary_color || '#15803d';
  const accentColor = store?.theme_config?.colors?.accent || store?.accent_color || '#10b981';

  // Loading state
  if (isLoading) {
    return <StoreLandingSkeleton />;
  }

  // Store not found
  if (error || !store) {
    return <StoreNotFound />;
  }

  // Store inactive
  if (!store.is_active) {
    return (
      <div className="min-h-dvh bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Clock className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">Coming Soon</h1>
          <p className="text-neutral-500">
            This store is getting ready to launch. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  const storeOpen = isStoreOpen(store.operating_hours);

  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* Hero Banner */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${accentColor} 100%)`,
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%)`,
            }}
          />
        </div>

        <div className="relative container mx-auto px-4 py-16 sm:py-24 lg:py-32">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            {/* Logo */}
            {store.logo_url ? (
              <OptimizedImage
                src={store.logo_url}
                alt={store.store_name}
                className="h-20 sm:h-24 lg:h-28 object-contain mb-6 drop-shadow-lg"
                priority
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20  flex items-center justify-center mb-6">
                <Leaf className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
            )}

            {/* Store Name */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
              {store.store_name}
            </h1>

            {/* Tagline */}
            {store.tagline && (
              <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-xl leading-relaxed">
                {store.tagline}
              </p>
            )}

            {/* Status badge */}
            <div className="flex items-center gap-3 mb-8">
              <Badge
                variant="secondary"
                className={
                  storeOpen
                    ? 'bg-white/20 text-white border-white/30 '
                    : 'bg-yellow-500/20 text-yellow-100 border-yellow-500/30 '
                }
              >
                <span
                  className={`w-2 h-2 rounded-full mr-2 inline-block ${
                    storeOpen ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'
                  }`}
                />
                {storeOpen ? 'Open Now' : 'Currently Closed'}
              </Badge>
            </div>

            {/* CTA */}
            <Link to={`/store/${store.slug}/menu`}>
              <Button
                size="lg"
                className="rounded-full px-8 py-6 text-base font-semibold shadow-xl hover:shadow-2xl transition-all bg-white hover:bg-white/90"
                style={{ color: primaryColor }}
              >
                Browse Menu
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" className="w-full h-auto" preserveAspectRatio="none">
            <path
              d="M0,40 C360,80 720,0 1440,40 L1440,60 L0,60 Z"
              fill="#fafafa"
            />
          </svg>
        </div>
      </section>

      {/* Category Cards */}
      {categories.length > 0 && (
        <section className="container mx-auto px-4 py-12 sm:py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                Shop by Category
              </h2>
              <p className="text-neutral-500 mt-1">Find exactly what you&apos;re looking for</p>
            </div>
            <Link
              to={`/shop/${store.slug}/products`}
              className="hidden sm:flex items-center text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: primaryColor }}
            >
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {categories.slice(0, 6).map((cat) => (
              <Link
                key={cat.category}
                to={`/shop/${store.slug}/products?category=${encodeURIComponent(cat.category)}`}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-neutral-200/80 bg-white cursor-pointer h-full">
                  <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center">
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <CategoryIcon category={cat.category} color={primaryColor} />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-neutral-800 line-clamp-1">
                      {cat.category}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      {cat.count} {cat.count === 1 ? 'product' : 'products'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Mobile "View All" link */}
          <div className="sm:hidden mt-4 text-center">
            <Link
              to={`/shop/${store.slug}/products`}
              className="inline-flex items-center text-sm font-medium"
              style={{ color: primaryColor }}
            >
              View All Categories
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
              Featured Products
            </h2>
            <p className="text-neutral-500 mt-1">Our most popular selections</p>
          </div>
          <Link
            to={`/shop/${store.slug}/products`}
            className="hidden sm:flex items-center text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: primaryColor }}
          >
            Shop All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((product) => (
              <FeaturedProductCard
                key={product.product_id}
                product={product}
                storeSlug={store.slug}
                accentColor={accentColor}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100">
            <Leaf className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p className="text-neutral-500">Products coming soon</p>
          </div>
        )}

        {/* Mobile "Shop All" link */}
        {featuredProducts.length > 0 && (
          <div className="sm:hidden mt-6 text-center">
            <Link to={`/shop/${store.slug}/products`}>
              <Button
                variant="outline"
                className="rounded-full px-6"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                Shop All Products
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* CTA Footer */}
      <section
        className="py-16 sm:py-20"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}08 0%, ${accentColor}12 100%)`,
        }}
      >
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3">
            Ready to Order?
          </h2>
          <p className="text-neutral-500 mb-8 text-lg">
            Browse our full selection and get premium cannabis delivered to your door.
          </p>
          <Link to={`/shop/${store.slug}`}>
            <Button
              size="lg"
              className="rounded-full px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Start Shopping
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {store.logo_url ? (
                <OptimizedImage
                  src={store.logo_url}
                  alt={store.store_name}
                  className="h-6 object-contain"
                />
              ) : (
                <Leaf className="w-5 h-5" style={{ color: primaryColor }} />
              )}
              <span className="font-semibold text-neutral-700">{store.store_name}</span>
            </div>
            <p className="text-xs text-neutral-400">
              &copy; {new Date().getFullYear()} {store.store_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Featured product card for the landing page */
function FeaturedProductCard({
  product,
  storeSlug,
  accentColor,
}: {
  product: StorefrontProduct;
  storeSlug: string;
  accentColor: string;
}) {
  const hasSalePrice = product.sale_price != null && product.sale_price < product.price;
  const displayPrice = hasSalePrice ? product.sale_price! : product.price;

  return (
    <Link to={`/shop/${storeSlug}/product/${product.product_id}`}>
      <div className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-neutral-50">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <ProductImage
              src={product.image_url}
              alt={product.product_name}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {hasSalePrice && (
              <span className="bg-red-500 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md">
                Sale
              </span>
            )}
            {product.strain_type && (
              <span
                className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md border  ${
                  product.strain_type === 'Indica'
                    ? 'bg-purple-100/90 text-purple-700 border-purple-200'
                    : product.strain_type === 'Sativa'
                      ? 'bg-amber-100/90 text-amber-700 border-amber-200'
                      : 'bg-emerald-100/90 text-emerald-700 border-emerald-200'
                }`}
              >
                {product.strain_type}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex flex-col flex-1">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
            {product.category}
          </p>
          <h3
            className="font-semibold text-sm sm:text-base leading-snug line-clamp-2 mb-2 group-hover:opacity-80 transition-opacity"
            style={{ color: accentColor }}
          >
            {product.product_name}
          </h3>

          {/* THC/CBD */}
          {(product.thc_content || product.cbd_content) && (
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-neutral-500 mb-2">
              {product.thc_content != null && (
                <span className="bg-neutral-100 px-1.5 py-0.5 rounded">
                  {product.thc_content}% THC
                </span>
              )}
              {product.cbd_content != null && (
                <span className="bg-neutral-100 px-1.5 py-0.5 rounded">
                  {product.cbd_content}% CBD
                </span>
              )}
            </div>
          )}

          {/* Price */}
          <div className="mt-auto pt-2 flex items-baseline gap-2">
            {displayPrice === 0 ? (
              <span className="text-lg font-extrabold text-emerald-600">Free</span>
            ) : (
              <span className="text-lg font-extrabold" style={{ color: accentColor }}>
                {formatCurrency(displayPrice)}
              </span>
            )}
            {hasSalePrice && (
              <span className="text-xs text-neutral-400 line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Map category names to icons */
function CategoryIcon({ category, color }: { category: string; color: string }) {
  const lower = category.toLowerCase();

  // Simple SVG icons for common cannabis categories
  if (lower.includes('flower') || lower.includes('bud')) {
    return <Leaf className="w-6 h-6 sm:w-7 sm:h-7" style={{ color }} />;
  }
  if (lower.includes('edible') || lower.includes('gummy') || lower.includes('food')) {
    return (
      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 0-7 7c0 3 2 6 7 13 5-7 7-10 7-13a7 7 0 0 0-7-7z" />
      </svg>
    );
  }
  if (lower.includes('vape') || lower.includes('cartridge') || lower.includes('pen')) {
    return (
      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="10" y="2" width="4" height="20" rx="2" />
        <circle cx="12" cy="18" r="1" />
      </svg>
    );
  }
  if (lower.includes('concentrate') || lower.includes('extract') || lower.includes('dab')) {
    return (
      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 7h-6l3-7z" />
        <circle cx="12" cy="15" r="5" />
      </svg>
    );
  }
  if (lower.includes('pre-roll') || lower.includes('preroll') || lower.includes('joint')) {
    return (
      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="19" y2="5" />
        <circle cx="18" cy="6" r="2" />
      </svg>
    );
  }
  if (lower.includes('topical') || lower.includes('cream') || lower.includes('balm')) {
    return (
      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="6" width="10" height="14" rx="2" />
        <path d="M10 6V4a2 2 0 0 1 4 0v2" />
      </svg>
    );
  }
  if (lower.includes('tincture') || lower.includes('oil')) {
    return (
      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2h4v4l3 10H7L10 6V2z" />
        <path d="M8 22h8" />
        <path d="M12 16v6" />
      </svg>
    );
  }
  if (lower.includes('accessory') || lower.includes('accessories') || lower.includes('gear')) {
    return <MapPin className="w-6 h-6 sm:w-7 sm:h-7" style={{ color }} />;
  }

  // Default icon
  return <Leaf className="w-6 h-6 sm:w-7 sm:h-7" style={{ color }} />;
}

/** Loading skeleton for the landing page */
function StoreLandingSkeleton() {
  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* Hero skeleton */}
      <div className="bg-neutral-200 animate-pulse">
        <div className="container mx-auto px-4 py-20 sm:py-28 flex flex-col items-center">
          <Skeleton className="w-24 h-24 rounded-2xl mb-6 bg-neutral-300" />
          <Skeleton className="h-10 w-64 mb-3 bg-neutral-300" />
          <Skeleton className="h-6 w-48 mb-8 bg-neutral-300" />
          <Skeleton className="h-12 w-40 rounded-full bg-neutral-300" />
        </div>
      </div>

      {/* Category skeletons */}
      <div className="container mx-auto px-4 py-12">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Product skeletons */}
      <div className="container mx-auto px-4 py-12">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
