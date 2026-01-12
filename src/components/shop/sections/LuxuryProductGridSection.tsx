import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, RefreshCw, Eye, Check, AlertTriangle, Moon, Smile, Zap, Target, Lightbulb, Activity, Sun, Filter, X, ShoppingCart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ProductImage from '@/components/ProductImage';
import { cleanProductName } from '@/utils/productName';
import { useShop } from '@/pages/shop/ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { ProductQuickViewModal } from './ProductQuickViewModal';
import { WishlistButton } from '../WishlistButton';
import { CartPreviewPopup } from '../CartPreviewPopup';
import { cn } from '@/lib/utils';

export interface LuxuryProductGridSectionProps {
  content?: {
    heading?: string;
    subheading?: string;
    show_search?: boolean;
    max_products?: number;
  };
  styles?: {
    accent_color?: string;
  };
  storeId?: string;
}

interface MarketplaceProduct {
  product_id: string;
  product_name: string;
  category: string;
  strain_type: string;
  price: number;
  description: string;
  image_url: string | null;
  images?: string[] | null; // Added images array support
  thc_content: number | null;
  cbd_content: number | null;
  is_visible: boolean;
  display_order: number;
  stock_quantity?: number;
  metrc_retail_id?: string | null;
  exclude_from_discounts?: boolean;
  minimum_price?: number;
  effects?: string[];
  min_expiry_days?: number;
  unit_type?: string; // Added for unit display
}

export function LuxuryProductGridSection({ content, styles, storeId }: LuxuryProductGridSectionProps) {
  const { storeSlug } = useParams();
  const { isPreviewMode } = useShop();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<MarketplaceProduct | null>(null);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [lastAddedItem, setLastAddedItem] = useState<{
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
  } | null>(null);

  const { addItem, cartCount, subtotal } = useShopCart({
    storeId,
    onCartChange: () => { },
  });

  const { toggleItem: toggleWishlist, isInWishlist } = useWishlist({ storeId });

  const {
    heading = "Menu",
    subheading = "Live Inventory",
    show_search = true,
    max_products = 50
  } = content || {};

  const customAccent = styles?.accent_color || '#015358';

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['luxury-products', storeId],
    queryFn: async () => {
      if (!storeId || storeId.length < 32) return [];
      try {
        const { data, error } = await supabase
          .rpc('get_marketplace_products', { p_store_id: storeId });
        if (error) {
          logger.error('Failed to fetch products', error);
          return [];
        }
        return (data as MarketplaceProduct[]) || [];
      } catch (err) {
        logger.error('Error fetching products', err);
        return [];
      }
    },
    enabled: !!storeId,
    retry: 2,
  });

  const categories = useMemo(() => {
    return ["All", ...new Set(products.map(p => p.category).filter(Boolean).sort())];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.product_name?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.strain_type?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory && selectedCategory !== "All") {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    return filtered.slice(0, max_products);
  }, [products, searchQuery, selectedCategory, max_products]);

  const handleQuickAdd = (e: React.MouseEvent, product: MarketplaceProduct) => {
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

      setAddedProducts(prev => new Set(prev).add(product.product_id));
      setLastAddedItem({
        name: product.product_name,
        price: product.price,
        imageUrl: product.image_url,
        quantity: 1
      });

      setTimeout(() => {
        setAddedProducts(prev => {
          const next = new Set(prev);
          next.delete(product.product_id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Failed to add",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const activeCategory = selectedCategory || "All";

  return (
    <section className="min-h-screen bg-[#F5F7F8] pb-32" id="products">

      {/* Search Overlay (if active) */}
      <AnimatePresence>
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-neutral-200"
          >
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <span className="text-neutral-500 text-sm">Showing results for <strong>"{searchQuery}"</strong></span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-neutral-400 hover:text-neutral-900"
              >
                Clear Search
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Category Strip - Premium Glassmorphism */}
      <div className="sticky top-20 z-40 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-4 md:px-8">
          <div
            className="flex items-center gap-1 overflow-x-auto py-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
            style={{ maskImage: 'linear-gradient(to right, transparent, black 20px, black 90%, transparent)' }}
          >
            {categories.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === "All" ? null : cat)}
                  className={cn(
                    "relative px-6 py-2.5 rounded-full text-sm font-bold transition-colors z-10 whitespace-nowrap",
                    isActive ? "text-white" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute inset-0 bg-[#015358] rounded-full shadow-lg shadow-teal-900/20 -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 pt-10">

        {/* Header - Staggered Fade In */}
        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 pl-1 border-l-4 border-[#0EC7BA] ml-1"
          >
            <h2 className="text-4xl font-extrabold text-[#015358] ml-4 tracking-tight">{heading}</h2>
            {subheading && <p className="text-neutral-500 ml-4 mt-2 font-medium">{subheading}</p>}
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 space-y-4 shadow-sm border border-neutral-100">
                <Skeleton className="h-56 w-full rounded-xl bg-neutral-100" />
                <Skeleton className="h-4 w-2/3 bg-neutral-100" />
                <Skeleton className="h-4 w-1/3 bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white rounded-3xl border border-dashed border-neutral-300">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mb-6 text-neutral-300">
              <Search className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-[#015358]">No matches found</h3>
            <p className="text-neutral-500 mt-2 max-w-md mx-auto">We couldn't find any products matching your filters.</p>
            <Button
              onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
              className="mt-8 bg-[#015358] text-white hover:bg-[#003d3f] rounded-full px-8 py-6 text-lg font-bold shadow-lg shadow-teal-900/10"
            >
              View All Products
            </Button>
          </div>
        ) : (
          /* Premium Product Grid */
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 lg:gap-8 pb-20"
          >
            <AnimatePresence>
              {filteredProducts.map((product, index) => (
                <StorefrontProductCard
                  key={product.product_id}
                  product={product}
                  storeSlug={storeSlug}
                  isPreviewMode={isPreviewMode}
                  onQuickAdd={(e) => handleQuickAdd(e, product)}
                  isAdded={addedProducts.has(product.product_id)}
                  onToggleWishlist={() => toggleWishlist({
                    productId: product.product_id,
                    name: product.product_name,
                    price: product.price,
                    imageUrl: product.image_url,
                  })}
                  isInWishlist={isInWishlist(product.product_id)}
                  onQuickView={() => setQuickViewProduct(product)}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <CartPreviewPopup
        item={lastAddedItem}
        cartCount={cartCount}
        cartTotal={subtotal}
        storeSlug={storeSlug || ''}
        onClose={() => setLastAddedItem(null)}
      />

      <ProductQuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={(p, a) => { }} // Pass actual handler if needed, currently reusing logic
        accentColor={customAccent}
      />
    </section>
  );
}

// Sub-component for performance and clean logic
function StorefrontProductCard({
  product,
  storeSlug,
  isPreviewMode,
  onQuickAdd,
  isAdded,
  onToggleWishlist,
  isInWishlist,
  onQuickView,
  index
}: {
  product: MarketplaceProduct;
  storeSlug?: string;
  isPreviewMode: boolean;
  onQuickAdd: (e: React.MouseEvent) => void;
  isAdded: boolean;
  onToggleWishlist: () => void;
  isInWishlist: boolean;
  onQuickView: () => void;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cleanedName = cleanProductName(product.product_name);
  const isOutStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity !== undefined && product.stock_quantity > 0 && product.stock_quantity <= 5;

  // Use secondary image on hover if available
  const displayImage = isHovered && product.images && product.images.length > 1
    ? product.images[1]
    : product.image_url;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-neutral-200/50 transition-all duration-500 h-full flex flex-col relative transform hover:-translate-y-2 backface-hidden">

        {/* Image Container */}
        <Link to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="block relative aspect-square overflow-hidden bg-neutral-50 cursor-pointer">
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105">
            <ProductImage
              src={displayImage}
              alt={cleanedName}
              className={cn("h-full w-full object-cover", isOutStock && "grayscale opacity-50")}
            />
          </div>

          {/* Quick Overlay Actions */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10">
            <button
              onClick={(e) => { e.preventDefault(); onToggleWishlist(); }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors border",
                isInWishlist ? "bg-red-50 text-red-500 border-red-100" : "bg-white text-neutral-400 hover:text-red-500 border-white"
              )}
            >
              <svg className={cn("w-5 h-5 transition-transform active:scale-75", isInWishlist && "fill-current")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onQuickView(); }}
              className="w-10 h-10 rounded-full bg-white text-neutral-400 hover:text-[#015358] border border-white flex items-center justify-center shadow-lg transition-colors delay-75"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>

          {/* Stock / Type Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            {product.strain_type && (
              <span className={cn(
                "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg backdrop-blur-md shadow-sm border",
                product.strain_type === 'Indica' ? "bg-purple-100/90 text-purple-700 border-purple-200" :
                  product.strain_type === 'Sativa' ? "bg-amber-100/90 text-amber-700 border-amber-200" :
                    "bg-emerald-100/90 text-emerald-700 border-emerald-200"
              )}>
                {product.strain_type}
              </span>
            )}
            {isLowStock && (
              <span className="bg-orange-500/90 text-white backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm">
                Low Stock
              </span>
            )}
          </div>

          {isOutStock && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-20">
              <span className="bg-neutral-900 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg shadow-xl transform -rotate-6">
                Sold Out
              </span>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex-1 space-y-2">
            <Link to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`} className="group-hover:text-[#0EC7BA] transition-colors block">
              <h3 className="font-bold text-[#015358] text-lg leading-snug line-clamp-2" title={cleanedName}>
                {cleanedName}
              </h3>
            </Link>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{product.category}</p>

            {(product.thc_content || product.cbd_content) && (
              <div className="flex flex-wrap gap-2 text-[10px] font-bold text-neutral-500 pt-1">
                {product.thc_content && <span className="bg-neutral-100 px-2 py-1 rounded-md">{product.thc_content}% THC</span>}
                {product.cbd_content && <span className="bg-neutral-100 px-2 py-1 rounded-md">{product.cbd_content}% CBD</span>}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-5 mt-2 flex items-center justify-between border-t border-neutral-50">
            <div className="flex flex-col">
              <span className="text-xl font-extrabold text-[#015358]">${product.price?.toFixed(2)}</span>
              {product.unit_type && <span className="text-[10px] text-neutral-400 font-medium">per {product.unit_type}</span>}
            </div>

            <Button
              onClick={onQuickAdd}
              disabled={isOutStock}
              size="sm"
              className={cn(
                "rounded-full h-10 px-5 font-bold transition-all duration-300 shadow-md",
                isAdded
                  ? "bg-emerald-500 text-white hover:bg-emerald-600 w-auto"
                  : isOutStock
                    ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
                    : "bg-[#015358] text-white hover:bg-[#0EC7BA] hover:text-[#015358] hover:shadow-lg hover:shadow-teal-900/20 active:scale-95"
              )}
            >
              <AnimatePresence mode="wait">
                {isAdded ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center"
                  >
                    <Check className="w-4 h-4 mr-1.5" strokeWidth={3} />
                    <span className="text-xs uppercase tracking-wider">Added</span>
                  </motion.div>
                ) : (
                  <div className="flex items-center">
                    <Plus className="w-4 h-4 mr-1.5" strokeWidth={3} />
                    <span className="text-xs uppercase tracking-wider">Add</span>
                  </div>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Add simple CSS usage for no-scrollbar utility if not present
// or presume Tailwind class 'scrollbar-hide' exists in utility layer
