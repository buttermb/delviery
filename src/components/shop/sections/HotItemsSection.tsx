/**
 * Hot Items Section
 *
 * Displays context-aware hot items that change based on time of day.
 * Shows different product recommendations for morning, afternoon, evening, and night.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  Sparkles,
  Zap,
  Coffee,
  Star,
  ChevronRight,
  Clock,
  Plus,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ProductImage from '@/components/ProductImage';
import { cn } from '@/lib/utils';
import { cleanProductName } from '@/utils/productName';
import { useContextAwareHotItems } from '@/hooks/useContextAwareHotItems';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { useWishlist } from '@/hooks/useWishlist';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { CartPreviewPopup } from '../CartPreviewPopup';
import type { StorefrontHotItem } from '@/types/storefront-hot-items';
import { formatSmartDate } from '@/lib/formatters';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export interface HotItemsSectionProps {
  content?: {
    show_time_indicator?: boolean;
    max_items?: number;
  };
  styles?: {
    accent_color?: string;
  };
  storeId?: string;
}

// Icon mapping
const ICON_MAP = {
  sun: Sun,
  coffee: Coffee,
  moon: Moon,
  sparkles: Sparkles,
  zap: Zap,
  star: Star,
} as const;

export function HotItemsSection({
  content,
  styles,
  storeId,
}: HotItemsSectionProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { isPreviewMode } = useShop();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [lastAddedItem, setLastAddedItem] = useState<{
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
  } | null>(null);

  const { show_time_indicator = true, max_items = 8 } = content || {};
  const customAccent = styles?.accent_color;

  const { items, config, context: _context, isLoading, error } = useContextAwareHotItems({
    storeId,
    limit: max_items,
  });

  const { addItem, cartCount, subtotal } = useShopCart({
    storeId,
    onCartChange: () => {},
  });

  const { toggleItem: toggleWishlist, isInWishlist } = useWishlist({ storeId });

  // Use config accent or custom accent
  const accentColor = customAccent || config.accentColor;
  const IconComponent = ICON_MAP[config.icon] || Star;

  const handleQuickAdd = (e: React.MouseEvent, product: StorefrontHotItem) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      addItem({
        productId: product.product_id,
        name: product.product_name,
        price: product.price,
        imageUrl: product.image_url,
        quantity: 1,
        variant: product.strain_type,
        metrcRetailId: product.metrc_retail_id,
        excludeFromDiscounts: product.exclude_from_discounts,
        minimumPrice: product.minimum_price,
        minExpiryDays: product.min_expiry_days,
      });

      setAddedProducts((prev) => new Set(prev).add(product.product_id));
      setLastAddedItem({
        name: product.product_name,
        price: product.price,
        imageUrl: product.image_url,
        quantity: 1,
      });

      setTimeout(() => {
        setAddedProducts((prev) => {
          const next = new Set(prev);
          next.delete(product.product_id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast.error('Failed to add', {
        description: humanizeError(error),
      });
    }
  };

  // Format current time for display
  const formatCurrentTime = () => {
    const now = new Date();
    return formatSmartDate(now, { includeTime: true });
  };

  // Loading state
  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-b from-neutral-50 to-white">
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-zinc-950 rounded-2xl p-3 space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Don't render if no items or error
  if (error || items.length === 0) {
    return null;
  }

  return (
    <section
      className="py-16 relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${accentColor}08 0%, transparent 100%)`,
      }}
    >
      {/* Decorative background elements */}
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: accentColor }}
      />
      <div
        className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: accentColor }}
      />

      <div className="container mx-auto px-4 md:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 8px 32px ${accentColor}40`,
              }}
            >
              <IconComponent className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">
                {config.title}
              </h2>
              <p className="text-neutral-500 text-sm md:text-base">
                {config.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {show_time_indicator && (
              <Badge
                variant="outline"
                className="px-3 py-1.5 text-sm font-medium bg-white/80 backdrop-blur-sm"
                style={{ borderColor: `${accentColor}30`, color: accentColor }}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                {formatCurrentTime()}
              </Badge>
            )}
            <Link
              to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}
              className="group flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
              style={{ color: accentColor }}
            >
              View All
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          <AnimatePresence>
            {items.map((product, index) => (
              <HotItemCard
                key={product.product_id}
                product={product}
                storeSlug={storeSlug}
                isPreviewMode={isPreviewMode}
                accentColor={accentColor}
                index={index}
                onQuickAdd={(e) => handleQuickAdd(e, product)}
                isAdded={addedProducts.has(product.product_id)}
                onToggleWishlist={() =>
                  toggleWishlist({
                    productId: product.product_id,
                    name: product.product_name,
                    price: product.price,
                    imageUrl: product.image_url,
                  })
                }
                isInWishlist={isInWishlist(product.product_id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <CartPreviewPopup
        item={lastAddedItem}
        cartCount={cartCount}
        cartTotal={subtotal}
        storeSlug={storeSlug ?? ''}
        onClose={() => setLastAddedItem(null)}
      />
    </section>
  );
}

// Hot Item Card Component
interface HotItemCardProps {
  product: StorefrontHotItem;
  storeSlug?: string;
  isPreviewMode: boolean;
  accentColor: string;
  index: number;
  onQuickAdd: (e: React.MouseEvent) => void;
  isAdded: boolean;
  onToggleWishlist: () => void;
  isInWishlist: boolean;
}

function HotItemCard({
  product,
  storeSlug,
  isPreviewMode,
  accentColor,
  index,
  onQuickAdd,
  isAdded,
  onToggleWishlist,
  isInWishlist,
}: HotItemCardProps) {
  const cleanedName = cleanProductName(product.product_name);
  const isOutStock =
    product.stock_quantity !== undefined && product.stock_quantity <= 0;
  const hasSalePrice =
    product.sale_price != null && product.sale_price < product.price;
  const displayPrice = hasSalePrice ? product.sale_price : product.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
    >
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col relative transform hover:-translate-y-1">
        {/* Image */}
        <Link
          to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`}
          className="block relative aspect-square overflow-hidden bg-neutral-50"
        >
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <ProductImage
              src={product.image_url}
              alt={cleanedName}
              className={cn(
                'h-full w-full object-cover',
                isOutStock && 'grayscale opacity-50'
              )}
            />
          </div>

          {/* Time Badge */}
          {product.timeBadge && (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-white shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              {product.timeBadge}
            </div>
          )}

          {/* Sale Badge */}
          {hasSalePrice && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-white bg-red-500 shadow-md">
              Sale
            </div>
          )}

          {/* Wishlist Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleWishlist();
            }}
            aria-label={
              isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'
            }
            className={cn(
              'absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0',
              isInWishlist
                ? 'bg-red-50 text-red-500'
                : 'bg-white/90 text-neutral-400 hover:text-red-500'
            )}
          >
            <svg
              className={cn(
                'w-4 h-4',
                isInWishlist && 'fill-current'
              )}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </button>

          {isOutStock && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-neutral-900 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg">
                Sold Out
              </span>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex-1 space-y-1.5 mb-3">
            <Link
              to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`}
            >
              <h3
                className="font-bold text-sm md:text-base leading-snug line-clamp-2 hover:opacity-80 transition-opacity"
                style={{ color: accentColor }}
                title={cleanedName}
              >
                {cleanedName}
              </h3>
            </Link>
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
              {product.category}
            </p>

            {/* Hot reason */}
            <p className="text-xs text-neutral-500 italic line-clamp-1">
              {product.hotReason}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-50">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-lg font-bold"
                style={{ color: accentColor }}
              >
                {formatCurrency(displayPrice)}
              </span>
              {hasSalePrice && (
                <span className="text-xs text-neutral-400 line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>

            <Button
              onClick={onQuickAdd}
              disabled={isOutStock}
              size="sm"
              className={cn(
                'rounded-full h-8 w-8 p-0 transition-all duration-200 shadow',
                isAdded
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : isOutStock
                    ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    : 'text-white hover:opacity-90'
              )}
              style={
                !isAdded && !isOutStock
                  ? { backgroundColor: accentColor }
                  : undefined
              }
            >
              <AnimatePresence mode="wait">
                {isAdded ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
                  </motion.div>
                ) : (
                  <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
