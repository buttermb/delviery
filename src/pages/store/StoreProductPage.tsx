/**
 * Public Store Product Detail Page
 * /store/:slug/product/:id - No auth required
 * Product image gallery, details, pricing, quantity selector, add to cart,
 * lab test results, related products carousel, breadcrumb navigation
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Leaf,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  FlaskConical,
  ExternalLink,
  Beaker,
  Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import StoreNotFound from '@/components/shop/StoreNotFound';
import ProductNotFound from '@/components/shop/ProductNotFound';

// ── Types ───────────────────────────────────────────────────────────────────

interface StoreData {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  is_active: boolean;
  theme_config?: {
    colors?: {
      primary?: string;
      accent?: string;
    };
  } | null;
}

interface ProductDetail {
  product_id: string;
  product_name: string;
  category: string;
  strain_type: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[] | null;
  thc_content: number | null;
  cbd_content: number | null;
  thca_percentage: number | null;
  description: string | null;
  effects: string[] | null;
  terpenes: unknown;
  consumption_methods: string[] | null;
  medical_benefits: string[] | null;
  strain_name: string | null;
  strain_lineage: string | null;
  usage_tips: string | null;
  lab_results_url: string | null;
  lab_name: string | null;
  test_date: string | null;
  coa_url: string | null;
  coa_pdf_url: string | null;
  in_stock: boolean | null;
  display_order: number;
}

interface RelatedProduct {
  product_id: string;
  product_name: string;
  category: string;
  strain_type: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  thc_content: number | null;
  cbd_content: number | null;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function StoreProductPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // ── Fetch Store ──────────────────────────────────────────────────────────

  const {
    data: store,
    isLoading: storeLoading,
    error: storeError,
  } = useQuery({
    queryKey: queryKeys.storePages.product(slug),
    queryFn: async (): Promise<StoreData | null> => {
      if (!slug) return null;

      const { data, error } = await supabase.rpc(
        'get_marketplace_store_by_slug',
        { p_slug: slug }
      );

      if (error) {
        logger.error('Failed to fetch store', error, { component: 'StoreProductPage' });
        throw error;
      }

      if (!data || !Array.isArray(data) || data.length === 0) return null;
      return data[0] as unknown as StoreData;
    },
    enabled: !!slug,
    retry: false,
    staleTime: 60_000,
  });

  // ── Fetch Product Detail ─────────────────────────────────────────────────

  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useQuery({
    queryKey: queryKeys.storePages.productDetail(store?.tenant_id, id),
    queryFn: async (): Promise<ProductDetail | null> => {
      if (!store?.tenant_id || !id) return null;

      const { data, error } = await supabase
        .from('products')
        .select(
          'product_id, product_name, category, strain_type, price, sale_price, image_url, images, thc_content, cbd_content, thca_percentage, description, effects, terpenes, consumption_methods, medical_benefits, strain_name, strain_lineage, usage_tips, lab_results_url, lab_name, test_date, coa_url, coa_pdf_url, in_stock, display_order'
        )
        .eq('tenant_id', store.tenant_id)
        .eq('product_id', id)
        .eq('is_visible', true)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch product detail', error, { component: 'StoreProductPage' });
        throw error;
      }

      return data as unknown as ProductDetail | null;
    },
    enabled: !!store?.tenant_id && !!id,
    staleTime: 60_000,
  });

  // ── Fetch Related Products (same category, excluding current) ────────────

  const { data: relatedProducts = [] } = useQuery({
    queryKey: queryKeys.storePages.relatedProducts(store?.tenant_id, product?.category, id),
    queryFn: async (): Promise<RelatedProduct[]> => {
      if (!store?.tenant_id || !product?.category) return [];

      const { data, error } = await supabase
        .from('products')
        .select(
          'product_id, product_name, category, strain_type, price, sale_price, image_url, thc_content, cbd_content'
        )
        .eq('tenant_id', store.tenant_id)
        .eq('is_visible', true)
        .eq('category', product.category)
        .neq('product_id', id ?? '')
        .order('display_order', { ascending: true })
        .limit(8);

      if (error) {
        logger.error('Failed to fetch related products', error, { component: 'StoreProductPage' });
        return [];
      }

      return (data ?? []) as unknown as RelatedProduct[];
    },
    enabled: !!store?.tenant_id && !!product?.category,
    staleTime: 60_000,
  });

  // ── Image gallery ─────────────────────────────────────────────────────────

  const allImages = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    if (product.image_url) imgs.push(product.image_url);
    if (product.images?.length) {
      for (const img of product.images) {
        if (img && !imgs.includes(img)) imgs.push(img);
      }
    }
    return imgs;
  }, [product]);

  // ── Pricing ───────────────────────────────────────────────────────────────

  const hasSalePrice = product?.sale_price != null && product.sale_price < product.price;
  const displayPrice = hasSalePrice ? product!.sale_price! : (product?.price ?? 0);

  // ── Lab results availability ──────────────────────────────────────────────

  const hasLabResults =
    product?.lab_results_url ||
    product?.coa_url ||
    product?.coa_pdf_url ||
    product?.lab_name ||
    product?.test_date;

  // ── Terpene data ──────────────────────────────────────────────────────────

  const terpeneList = useMemo(() => {
    if (!product?.terpenes) return [];
    if (Array.isArray(product.terpenes)) return product.terpenes as string[];
    if (typeof product.terpenes === 'object' && product.terpenes !== null) {
      return Object.entries(product.terpenes as Record<string, unknown>).map(
        ([name, value]) => (typeof value === 'number' ? `${name} (${value}%)` : name)
      );
    }
    return [];
  }, [product?.terpenes]);

  // ── SEO ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (product?.product_name && store?.store_name) {
      document.title = `${product.product_name} | ${store.store_name}`;
    }
    return () => {
      document.title = 'FloraIQ';
    };
  }, [product?.product_name, store?.store_name]);

  // ── Colors ────────────────────────────────────────────────────────────────

  const primaryColor =
    store?.theme_config?.colors?.primary || store?.primary_color || '#15803d';
  const accentColor =
    store?.theme_config?.colors?.accent || store?.accent_color || '#10b981';

  // ── Loading ───────────────────────────────────────────────────────────────

  if (storeLoading || productLoading) {
    return <ProductPageSkeleton />;
  }

  // ── Error / Not Found ─────────────────────────────────────────────────────

  if (storeError || !store || !store.is_active) {
    return <StoreNotFound />;
  }

  if (productError || !product) {
    return (
      <div className="min-h-dvh bg-neutral-50">
        <StoreHeader store={store} primaryColor={primaryColor} />
        <ProductNotFound storeSlug={store.slug} routePrefix="store" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* Header */}
      <StoreHeader store={store} primaryColor={primaryColor} />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/store/${store.slug}`}>{store.store_name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/store/${store.slug}/menu`}>Menu</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1 max-w-[200px]">
                {product.product_name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Product Content */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ── Left: Image Gallery ──────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm">
              {allImages.length > 0 ? (
                <ProductImage
                  src={allImages[selectedImageIndex]}
                  alt={product.product_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ProductImage
                  src={null}
                  alt={product.product_name}
                  className="h-full w-full"
                />
              )}

              {/* Sale badge */}
              {hasSalePrice && (
                <span className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 text-xs font-bold uppercase rounded-lg shadow">
                  Sale
                </span>
              )}

              {/* Strain badge */}
              {product.strain_type && (
                <span
                  className={cn(
                    'absolute top-4 right-4 px-3 py-1 text-xs font-bold uppercase rounded-lg border  shadow-sm',
                    product.strain_type === 'Indica'
                      ? 'bg-purple-100/90 text-purple-700 border-purple-200'
                      : product.strain_type === 'Sativa'
                        ? 'bg-amber-100/90 text-amber-700 border-amber-200'
                        : 'bg-emerald-100/90 text-emerald-700 border-emerald-200'
                  )}
                >
                  {product.strain_type}
                </span>
              )}

              {/* Image navigation arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((prev) =>
                        prev > 0 ? prev - 1 : allImages.length - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80  shadow-md flex items-center justify-center hover:bg-white transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5 text-neutral-700" />
                  </button>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((prev) =>
                        prev < allImages.length - 1 ? prev + 1 : 0
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80  shadow-md flex items-center justify-center hover:bg-white transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5 text-neutral-700" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={cn(
                      'w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all',
                      idx === selectedImageIndex
                        ? 'border-current shadow-md scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    )}
                    style={
                      idx === selectedImageIndex ? { borderColor: primaryColor } : undefined
                    }
                    aria-label={`View image ${idx + 1}`}
                  >
                    <ProductImage
                      src={img}
                      alt={`${product.product_name} ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Product Details ───────────────────────────────────── */}
          <div className="space-y-6">
            {/* Category & Strain */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {product.category}
              </span>
              {product.strain_name && (
                <>
                  <span className="text-neutral-300">|</span>
                  <span className="text-xs font-medium text-neutral-500">
                    {product.strain_name}
                  </span>
                </>
              )}
            </div>

            {/* Product Name */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 leading-tight">
              {product.product_name}
            </h1>

            {/* THC / CBD Badges */}
            <div className="flex flex-wrap gap-2">
              {product.thc_content != null && (
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 text-sm px-3 py-1">
                  {product.thc_content}% THC
                </Badge>
              )}
              {product.cbd_content != null && (
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 text-sm px-3 py-1">
                  {product.cbd_content}% CBD
                </Badge>
              )}
              {product.thca_percentage != null && product.thca_percentage > 0 && (
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 text-sm px-3 py-1">
                  {product.thca_percentage}% THCa
                </Badge>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-neutral-600 leading-relaxed text-base">
                {product.description}
              </p>
            )}

            {/* Strain Lineage */}
            {product.strain_lineage && (
              <div className="text-sm text-neutral-500">
                <span className="font-medium text-neutral-700">Lineage:</span>{' '}
                {product.strain_lineage}
              </div>
            )}

            {/* Effects */}
            {product.effects && product.effects.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">Effects</h3>
                <div className="flex flex-wrap gap-1.5">
                  {product.effects.map((effect) => (
                    <Badge
                      key={effect}
                      variant="outline"
                      className="text-xs font-medium"
                    >
                      {effect}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Terpenes */}
            {terpeneList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">Terpenes</h3>
                <div className="flex flex-wrap gap-1.5">
                  {terpeneList.map((terpene) => (
                    <Badge
                      key={terpene}
                      variant="outline"
                      className="text-xs font-medium bg-emerald-50 border-emerald-200 text-emerald-700"
                    >
                      {terpene}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Tips */}
            {product.usage_tips && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700">{product.usage_tips}</p>
              </div>
            )}

            <Separator />

            {/* Price & Quantity */}
            <div className="space-y-4">
              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span
                  className="text-3xl font-extrabold"
                  style={{ color: accentColor }}
                >
                  {formatCurrency(displayPrice)}
                </span>
                {hasSalePrice && (
                  <span className="text-lg text-neutral-400 line-through">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>

              {/* Stock status */}
              {product.in_stock === false && (
                <p className="text-sm font-medium text-red-600">Out of stock</p>
              )}

              {/* Quantity selector */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-neutral-700">Quantity</span>
                <div className="flex items-center border rounded-lg bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-2.5 text-neutral-500 hover:text-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-semibold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    disabled={quantity >= 10}
                    className="p-2.5 text-neutral-500 hover:text-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add to Cart */}
              <Link
                to={`/shop/${store.slug}/product/${product.product_id}`}
                className="block"
              >
                <Button
                  size="lg"
                  className="w-full rounded-xl text-white text-base font-semibold shadow-lg hover:shadow-xl transition-all py-6"
                  style={{ backgroundColor: primaryColor }}
                  disabled={product.in_stock === false}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {product.in_stock === false ? 'Out of Stock' : 'Add to Cart'}
                </Button>
              </Link>
              <p className="text-xs text-neutral-400 text-center">
                Complete your purchase in our full shop experience
              </p>
            </div>
          </div>
        </div>

        {/* ── Lab Test Results Section ────────────────────────────────────── */}
        {hasLabResults && (
          <section className="mt-12">
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <FlaskConical className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">Lab Test Results</h2>
                  <p className="text-sm text-neutral-500">
                    Third-party verified quality testing
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* THC */}
                {product.thc_content != null && (
                  <LabResultCard
                    label="THC"
                    value={`${product.thc_content}%`}
                    color="#8b5cf6"
                  />
                )}
                {/* CBD */}
                {product.cbd_content != null && (
                  <LabResultCard
                    label="CBD"
                    value={`${product.cbd_content}%`}
                    color="#3b82f6"
                  />
                )}
                {/* THCa */}
                {product.thca_percentage != null && product.thca_percentage > 0 && (
                  <LabResultCard
                    label="THCa"
                    value={`${product.thca_percentage}%`}
                    color="#a855f7"
                  />
                )}
                {/* Lab Name */}
                {product.lab_name && (
                  <LabResultCard
                    label="Tested By"
                    value={product.lab_name}
                    color="#10b981"
                    isText
                  />
                )}
              </div>

              {/* Test date */}
              {product.test_date && (
                <p className="text-sm text-neutral-500 mb-4">
                  <Beaker className="w-4 h-4 inline-block mr-1 -mt-0.5" />
                  Test date:{' '}
                  {new Date(product.test_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}

              {/* COA Links */}
              <div className="flex flex-wrap gap-3">
                {product.lab_results_url && (
                  <a
                    href={product.lab_results_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-neutral-50"
                    style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Lab Results
                  </a>
                )}
                {product.coa_url && (
                  <a
                    href={product.coa_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-neutral-50"
                    style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Certificate of Analysis
                  </a>
                )}
                {product.coa_pdf_url && (
                  <a
                    href={product.coa_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-neutral-50"
                    style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Download COA (PDF)
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Consumption Methods & Medical Benefits ─────────────────────── */}
        {((product.consumption_methods && product.consumption_methods.length > 0) ||
          (product.medical_benefits && product.medical_benefits.length > 0)) && (
          <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {product.consumption_methods && product.consumption_methods.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-3">
                  Consumption Methods
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {product.consumption_methods.map((method) => (
                    <Badge
                      key={method}
                      variant="secondary"
                      className="text-xs"
                    >
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {product.medical_benefits && product.medical_benefits.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-3">
                  Reported Benefits
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {product.medical_benefits.map((benefit) => (
                    <Badge
                      key={benefit}
                      variant="secondary"
                      className="text-xs"
                    >
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Related Products Carousel ──────────────────────────────────── */}
        {relatedProducts.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">
                Related Products
              </h2>
              <Link
                to={`/store/${store.slug}/menu?category=${encodeURIComponent(product.category)}`}
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: primaryColor }}
              >
                View All
                <ChevronRight className="w-4 h-4 inline-block ml-0.5" />
              </Link>
            </div>

            <Carousel
              opts={{ align: 'start', loop: relatedProducts.length > 4 }}
              className="w-full"
            >
              <CarouselContent className="-ml-3">
                {relatedProducts.map((rp) => (
                  <CarouselItem
                    key={rp.product_id}
                    className="pl-3 basis-1/2 sm:basis-1/3 lg:basis-1/4"
                  >
                    <RelatedProductCard
                      product={rp}
                      storeSlug={store.slug}
                      accentColor={accentColor}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {relatedProducts.length > 4 && (
                <>
                  <CarouselPrevious className="-left-3 sm:-left-5" />
                  <CarouselNext className="-right-3 sm:-right-5" />
                </>
              )}
            </Carousel>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link to={`/store/${store.slug}`} className="flex items-center gap-2">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.store_name}
                  className="h-5 object-contain"
                  loading="lazy"
                />
              ) : (
                <Leaf className="w-4 h-4" style={{ color: primaryColor }} />
              )}
              <span className="font-semibold text-sm text-neutral-700">
                {store.store_name}
              </span>
            </Link>
            <p className="text-xs text-neutral-400">
              &copy; {new Date().getFullYear()} {store.store_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────────

/** Store header bar */
function StoreHeader({
  store,
  primaryColor,
}: {
  store: StoreData;
  primaryColor: string;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to={`/store/${store.slug}`} className="flex items-center gap-2">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.store_name}
                className="h-8 object-contain"
              />
            ) : (
              <Leaf className="w-6 h-6" style={{ color: primaryColor }} />
            )}
            <span className="font-bold text-neutral-800">
              {store.store_name}
            </span>
          </Link>

          <Link to={`/store/${store.slug}/menu`}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Menu
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Lab result card */
function LabResultCard({
  label,
  value,
  color,
  isText = false,
}: {
  label: string;
  value: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        borderColor: `${color}20`,
        backgroundColor: `${color}08`,
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color }}>
        {label}
      </p>
      <p
        className={cn(
          'font-bold',
          isText ? 'text-sm text-neutral-800' : 'text-2xl'
        )}
        style={isText ? undefined : { color }}
      >
        {value}
      </p>
    </div>
  );
}

/** Related product card for the carousel */
function RelatedProductCard({
  product,
  storeSlug,
  accentColor,
}: {
  product: RelatedProduct;
  storeSlug: string;
  accentColor: string;
}) {
  const hasSalePrice = product.sale_price != null && product.sale_price < product.price;
  const displayPrice = hasSalePrice ? product.sale_price! : product.price;

  return (
    <Link to={`/store/${storeSlug}/product/${product.product_id}`}>
      <div className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
        <div className="relative aspect-square overflow-hidden bg-neutral-50">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <ProductImage
              src={product.image_url}
              alt={product.product_name}
              className="h-full w-full object-cover"
            />
          </div>

          {product.strain_type && (
            <span
              className={cn(
                'absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ',
                product.strain_type === 'Indica'
                  ? 'bg-purple-100/90 text-purple-700 border-purple-200'
                  : product.strain_type === 'Sativa'
                    ? 'bg-amber-100/90 text-amber-700 border-amber-200'
                    : 'bg-emerald-100/90 text-emerald-700 border-emerald-200'
              )}
            >
              {product.strain_type}
            </span>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
            {product.category}
          </p>
          <h3
            className="font-semibold text-sm leading-snug line-clamp-2 mb-2 group-hover:opacity-80 transition-opacity"
            style={{ color: accentColor }}
          >
            {product.product_name}
          </h3>

          {(product.thc_content != null || product.cbd_content != null) && (
            <div className="flex flex-wrap gap-1 text-[10px] font-bold text-neutral-500 mb-2">
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

          <div className="mt-auto pt-2 flex items-baseline gap-2">
            <span className="text-lg font-extrabold" style={{ color: accentColor }}>
              {formatCurrency(displayPrice)}
            </span>
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

/** Loading skeleton for the product detail page */
function ProductPageSkeleton() {
  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-neutral-200">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      {/* Breadcrumb skeleton */}
      <div className="container mx-auto px-4 py-3">
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Content skeleton */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image skeleton */}
          <div className="space-y-4">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-20 h-20 rounded-lg shrink-0" />
              ))}
            </div>
          </div>

          {/* Details skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
