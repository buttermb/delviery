/**
 * Product Detail Page
 * Full product view with gallery, variants, reviews, and add-to-cart
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { useShopCart } from '@/hooks/useShopCart';
import { useProductStock } from '@/hooks/useInventoryCheck';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { sanitizeHtml, safeJsonParse } from '@/lib/utils/sanitize';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Heart,
  Share2,
  Minus,
  Plus,
  Check,
  Star,
  Truck,
  Shield,
  RotateCcw,
  Package,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  Copy,
  Facebook,
  Twitter,
  MessageCircle,
  Loader2,
  Moon,
  Smile,
  Zap,
  Target,
  Lightbulb,
  Activity,
  Sun,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReviewForm } from '@/components/shop/ReviewForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { RecentlyViewedSection } from '@/components/shop/RecentlyViewedSection';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { StockWarning } from '@/components/shop/StockWarning';
import { EnhancedStickyAddToCart } from '@/components/shop/EnhancedStickyAddToCart';
import { ScrollProgress } from '@/components/shop/ScrollProgress';
import { CartPreviewPopup } from '@/components/shop/CartPreviewPopup';

interface RpcProduct {
  product_id: string;
  product_name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[] | null;
  is_featured: boolean;
  is_on_sale: boolean;
  stock_quantity: number;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  sort_order: number;
  created_at: string;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  effects: string[] | null;
  min_expiry_days: number | null;
}

interface ProductDetails {
  product_id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  price: number;
  display_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  images: string[];
  in_stock: boolean;
  is_featured: boolean;
  marketplace_category_name: string | null;
  variants: any[];
  tags: string[];
  brand: string | null;
  sku: string | null;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  effects: string[];
  min_expiry_days: number | null;
}

// Transform RPC response to component interface
function transformProduct(rpc: RpcProduct): ProductDetails {
  return {
    product_id: rpc.product_id,
    name: rpc.product_name,
    description: rpc.description,
    short_description: rpc.description?.substring(0, 150) || null,
    category: rpc.category,
    price: rpc.price,
    display_price: rpc.sale_price || rpc.price,
    compare_at_price: rpc.sale_price ? rpc.price : null,
    image_url: rpc.image_url,
    images: rpc.images || [],
    in_stock: rpc.stock_quantity > 0,
    is_featured: rpc.is_featured,
    marketplace_category_name: rpc.category,
    variants: [],
    tags: [],
    brand: rpc.brand,
    sku: rpc.sku,
    strain_type: rpc.strain_type,
    thc_content: rpc.thc_content,
    cbd_content: rpc.cbd_content,
    metrc_retail_id: rpc.metrc_retail_id,
    exclude_from_discounts: rpc.exclude_from_discounts,
    minimum_price: rpc.minimum_price,
    effects: rpc.effects || [],
    min_expiry_days: rpc.min_expiry_days,
  };
}

interface ProductReview {
  id: string;
  customer_name: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

export default function ProductDetailPage() {
  const { storeSlug, productId, productSlug } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();

  // Determine if using slug-based or UUID-based URL
  const isSlugBased = !!productSlug && !productId;
  const identifier = productSlug || productId;
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textPrimary, textMuted } = useLuxuryTheme();
  const { toast } = useToast();

  // Use unified cart hook
  const { addItem, cartCount, subtotal } = useShopCart({
    storeId: store?.id,
    onCartChange: setCartItemCount,
  });

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showAddedAnimation, setShowAddedAnimation] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<{
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
  } | null>(null);

  // Track recently viewed products
  const { addToRecentlyViewed } = useRecentlyViewed();

  // Fetch product details - supports both UUID and slug lookups
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['shop-product', store?.id, identifier, isSlugBased],
    queryFn: async () => {
      if (!store?.id || !identifier) return null;

      try {
        if (isSlugBased) {
          // Slug-based lookup using the new RPC
          const { data, error } = await supabase
            .rpc('get_product_by_slug', {
              p_store_id: store.id,
              p_slug: identifier
            });

          if (error) {
            logger.error('Failed to fetch product by slug', error);
            return null;
          }

          if (data && data.length > 0) {
            const item = data[0];
            return {
              product_id: item.product_id,
              name: item.product_name,
              description: item.description,
              short_description: item.description?.substring(0, 150) || null,
              category: item.category,
              price: item.price,
              display_price: item.sale_price || item.price,
              compare_at_price: item.sale_price ? item.price : null,
              image_url: item.image_url,
              images: item.images || [],
              in_stock: item.stock_quantity > 0,
              is_featured: item.is_featured,
              marketplace_category_name: item.category,
              variants: [],
              tags: [],
              brand: item.brand,
              sku: item.sku,
              strain_type: item.strain_type,
              thc_content: item.thc_content,
              cbd_content: item.cbd_content,
              metrc_retail_id: null,
              exclude_from_discounts: false,
              minimum_price: null,
              effects: [],
              slug: item.slug,
            } as ProductDetails & { slug?: string };
          }
          return null;
        } else {
          // UUID-based lookup (existing logic)
          const { data, error } = await supabase
            .rpc('get_marketplace_products', { p_store_id: store.id });

          if (error) {
            logger.error('Failed to fetch product', error);
            return null;
          }

          const products = (data || []).map((item: RpcProduct) => transformProduct(item));
          return products.find((p: ProductDetails) => p.product_id === identifier) || null;
        }
      } catch (err) {
        logger.error('Error fetching product', err);
        return null;
      }
    },
    enabled: !!store?.id && !!identifier,
  });

  // Fetch product reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['product-reviews', store?.id, product?.product_id],
    queryFn: async () => {
      if (!store?.id || !product?.product_id) return [];

      const { data, error } = await supabase
        .from('marketplace_reviews')
        .select('*')
        .eq('store_id', store.id)
        .eq('product_id', product.product_id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ProductReview[];
    },
    enabled: !!store?.id && !!product?.product_id,
  });

  // Fetch related products
  const { data: relatedProducts = [] } = useQuery({
    queryKey: ['related-products', store?.id, product?.category],
    queryFn: async () => {
      if (!store?.id || !product?.category) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: store.id });

      if (error) throw error;
      return (data || [])
        .map((item: RpcProduct) => transformProduct(item))
        .filter((p: ProductDetails) => p.product_id !== product?.product_id && p.category === product.category)
        .slice(0, 4);
    },
    enabled: !!store?.id && !!product?.category,
  });

  // Check wishlist status
  useEffect(() => {
    if (store?.id && product?.product_id) {
      const wishlist = safeJsonParse<string[]>(localStorage.getItem(`shop_wishlist_${store.id}`), []);
      setIsWishlisted(wishlist.includes(product.product_id));
    }
  }, [store?.id, product?.product_id]);

  // Calculate average rating
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  // Get all images
  const allImages = useMemo(() => {
    if (!product) return [];
    const images = product.images?.length ? product.images : [];
    if (product.image_url && !images.includes(product.image_url)) {
      return [product.image_url, ...images];
    }
    return images.length ? images : [product.image_url].filter(Boolean);
  }, [product]);

  // SEO: Update page title, meta tags, and structured data
  useEffect(() => {
    if (product && store) {
      // Update title
      document.title = `${product.name} | ${store.store_name}`;

      // Add to recently viewed
      if (product.product_id) {
        addToRecentlyViewed(product.product_id);
      }

      // SEO: Add canonical URL with slug if available
      const productWithSlug = product as ProductDetails & { slug?: string };
      const canonicalPath = productWithSlug.slug
        ? `/shop/${storeSlug}/product/${productWithSlug.slug}`
        : `/shop/${storeSlug}/products/${product.product_id}`;
      const canonicalUrl = `${window.location.origin}${canonicalPath}`;

      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', canonicalUrl);

      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', product.short_description || product.description || `Buy ${product.name} at ${store.store_name}`);
      } else {
        const newMeta = document.createElement('meta');
        newMeta.name = 'description';
        newMeta.content = product.short_description || product.description || `Buy ${product.name} at ${store.store_name}`;
        document.head.appendChild(newMeta);
      }

      // Add JSON-LD structured data for rich snippets
      const existingScript = document.getElementById('product-jsonld');
      if (existingScript) {
        existingScript.remove();
      }

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description || product.short_description,
        image: allImages.length > 0 ? allImages : undefined,
        sku: product.sku,
        brand: product.brand ? {
          '@type': 'Brand',
          name: product.brand
        } : undefined,
        offers: {
          '@type': 'Offer',
          url: window.location.href,
          priceCurrency: 'USD',
          price: product.display_price,
          availability: product.in_stock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: store.store_name
          }
        },
        aggregateRating: reviews.length > 0 ? {
          '@type': 'AggregateRating',
          ratingValue: averageRating.toFixed(1),
          reviewCount: reviews.length
        } : undefined
      };

      const script = document.createElement('script');
      script.id = 'product-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);

      // Cleanup on unmount
      return () => {
        const scriptToRemove = document.getElementById('product-jsonld');
        if (scriptToRemove) {
          scriptToRemove.remove();
        }
      };
    }
  }, [product, store, productId, addToRecentlyViewed, allImages, reviews, averageRating]);


  // Handle quantity change
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(99, prev + delta)));
  };

  // Toggle wishlist with error handling
  const toggleWishlist = () => {
    if (!store?.id || !productId) return;

    try {
      const wishlist = JSON.parse(localStorage.getItem(`shop_wishlist_${store.id}`) || '[]');
      let newWishlist;

      if (isWishlisted) {
        newWishlist = wishlist.filter((id: string) => id !== productId);
        toast({ title: 'Removed from wishlist' });
      } else {
        newWishlist = [...wishlist, productId];
        toast({ title: 'Added to wishlist', description: 'View in your account' });
      }

      localStorage.setItem(`shop_wishlist_${store.id}`, JSON.stringify(newWishlist));
      setIsWishlisted(!isWishlisted);
    } catch (error) {
      logger.error('Wishlist operation failed', error);
      toast({
        title: isWishlisted ? 'Removed from wishlist' : 'Added to wishlist',
        description: 'Changes may not persist across sessions'
      });
      setIsWishlisted(!isWishlisted);
    }
  };

  // Add to cart using the unified hook
  const handleAddToCart = () => {
    if (!store?.id || !product) return;

    setIsAddingToCart(true);

    // Use unified cart hook
    addItem({
      productId: product.product_id,
      quantity,
      price: product.display_price,
      name: product.name,
      imageUrl: product.image_url,
      variant: selectedVariant || undefined,
      metrcRetailId: product.metrc_retail_id,
      excludeFromDiscounts: product.exclude_from_discounts,
      minimumPrice: product.minimum_price || undefined,
      minExpiryDays: product.min_expiry_days,
    });

    // Show animation
    setShowAddedAnimation(true);

    // Show premium cart popup
    setLastAddedItem({
      name: product.name,
      price: product.display_price,
      imageUrl: product.image_url,
      quantity
    });

    setTimeout(() => {
      setShowAddedAnimation(false);
      setIsAddingToCart(false);
    }, 1500);
  };

  // Share product
  const handleShare = async (platform?: string) => {
    const url = window.location.href;
    const text = `Check out ${product?.name} at ${store?.store_name}`;

    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied!' });
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast({ title: 'Link copied!' });
      }
      return;
    }

    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
      return;
    }

    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
      return;
    }

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
      return;
    }

    // Native share
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, text, url });
      } catch {
        // User cancelled
      }
    }
  };

  // Render stars
  const renderStars = (rating: number, size = 'w-4 h-4') => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              size,
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-muted text-muted'
            )}
          />
        ))}
      </div>
    );
  };

  if (!store) return null;

  if (productLoading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Skeleton className="h-[600px] w-full rounded-3xl bg-white/5" />
            <div className="space-y-8">
              <Skeleton className="h-12 w-3/4 bg-white/5" />
              <Skeleton className="h-6 w-1/4 bg-white/5" />
              <Skeleton className="h-24 w-full bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground mb-6">
          This product doesn't exist or is no longer available.
        </p>
        <Link to={`/shop/${storeSlug}/products`}>
          <Button style={{ backgroundColor: store.primary_color }}>
            Browse Products
          </Button>
        </Link>
      </div>
    );
  }

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.display_price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.display_price / product.compare_at_price!) * 100)
    : 0;

  return (
    <div className={`min-h-dvh ${isLuxuryTheme ? 'bg-[#050505] text-white selection:bg-white/20' : 'bg-background'}`}>
      {/* Ambient Background Effects */}
      {isLuxuryTheme && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/10 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      )}

      {/* Cart Popup & Progress */}
      <ScrollProgress color={accentColor} />
      <CartPreviewPopup
        item={lastAddedItem}
        cartCount={cartCount}
        cartTotal={subtotal}
        storeSlug={storeSlug || ''}
        onClose={() => setLastAddedItem(null)}
      />

      <div className="relative z-10 pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
            <Link to={`/shop/${storeSlug}`} className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to={`/shop/${storeSlug}/products`} className="hover:text-primary transition-colors">Shop</Link>
            <ChevronRight className="w-4 h-4" />
            <span className={isLuxuryTheme ? "text-white/60" : "text-foreground"}>{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
            {/* Left Column: Image Gallery (Span 7) */}
            <div className="lg:col-span-7 space-y-6">
              <div
                className="relative aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden bg-white/5 group border border-white/5"
                onMouseEnter={() => setShowZoom(true)}
                onMouseLeave={() => setShowZoom(false)}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={selectedImage}
                    src={allImages[selectedImage] || '/placeholder.png'}
                    alt={product.name}
                    className={`w-full h-full object-cover transition-transform duration-700 ease-out ${showZoom ? 'scale-110' : 'scale-100'}`}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: showZoom ? 1.1 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                </AnimatePresence>

                {/* Luxury overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />

                <div className="absolute top-4 right-4 z-20 flex flex-col gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white"
                    onClick={toggleWishlist}
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white"
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {discountPercent > 0 && (
                    <Badge className="bg-red-500/90 hover:bg-red-500 backdrop-blur border-none text-white px-3 py-1 text-xs uppercase tracking-widest">
                      Sale
                    </Badge>
                  )}
                  {!product.in_stock && (
                    <Badge className="bg-zinc-800/90 text-zinc-300 backdrop-blur border-white/10 px-3 py-1 text-xs uppercase tracking-widest">
                      Sold Out
                    </Badge>
                  )}
                  {product.in_stock && (product as any).stock_quantity < 10 && (
                    <Badge className="bg-amber-500/90 text-black backdrop-blur border-none px-3 py-1 text-xs uppercase tracking-widest">
                      Low Stock
                    </Badge>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden transition-all duration-300 ${selectedImage === idx
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-black scale-105 opacity-100'
                        : 'opacity-50 hover:opacity-80 hover:scale-105'
                        }`}
                    >
                      <img src={img} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details (Span 5) */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-24 space-y-8">
                {/* Glassmorphism Details Card */}
                <div className={`rounded-3xl p-8 backdrop-blur-xl ${isLuxuryTheme ? 'bg-white/5 border border-white/10' : 'bg-card border'}`}>
                  {/* Brand & Category */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {product.brand && (
                        <span className="text-sm font-medium tracking-widest uppercase text-white/50">
                          {product.brand}
                        </span>
                      )}
                      {product.strain_type && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <Badge variant="outline" className={`border-white/10 bg-white/5 ${product.strain_type.toLowerCase() === 'sativa' ? 'text-yellow-400' :
                            product.strain_type.toLowerCase() === 'indica' ? 'text-purple-400' : 'text-emerald-400'
                            }`}>
                            {product.strain_type}
                          </Badge>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className={`text-sm font-medium ${isLuxuryTheme ? 'text-white' : ''}`}>{averageRating.toFixed(1)}</span>
                      <span className={`text-xs ${isLuxuryTheme ? 'text-white/40' : 'text-muted-foreground'}`}>({reviews.length})</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h1 className={`text-4xl md:text-5xl font-light tracking-tight mb-4 leading-tight ${isLuxuryTheme ? 'text-white' : ''}`}>
                    {product.name}
                  </h1>

                  {/* Short Description */}
                  {product.short_description && (
                    <p className={`text-lg leading-relaxed mb-6 ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
                      {product.short_description}
                    </p>
                  )}

                  {/* Price */}
                  <div className="flex items-baseline gap-4 mb-8">
                    <span className="text-3xl font-medium text-emerald-400">
                      {formatCurrency(product.display_price)}
                    </span>
                    {product.compare_at_price && (
                      <span className={`text-lg line-through ${isLuxuryTheme ? 'text-white/30 decoration-white/30' : 'text-muted-foreground'}`}>
                        {formatCurrency(product.compare_at_price)}
                      </span>
                    )}
                  </div>

                  <Separator className={isLuxuryTheme ? "bg-white/10 mb-8" : "mb-8"} />

                  {/* Variants */}
                  {product.variants && product.variants.length > 0 && (
                    <div className="mb-8 space-y-4">
                      <span className={`text-sm uppercase tracking-widest font-medium ${isLuxuryTheme ? 'text-white/50' : 'text-muted-foreground'}`}>Select Option</span>
                      <div className="flex flex-wrap gap-3">
                        {product.variants.map((variant: any) => {
                          const variantName = variant.name || variant;
                          return (
                            <button
                              key={variantName}
                              onClick={() => setSelectedVariant(variantName)}
                              className={`px-6 py-3 rounded-xl border transition-all duration-300 text-sm font-medium ${selectedVariant === variantName
                                ? 'bg-white text-black border-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                                : 'bg-transparent text-white/70 border-white/10 hover:border-white/30 hover:bg-white/5'
                                }`}
                            >
                              {variantName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add To Cart Actions */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center rounded-xl border p-1 ${isLuxuryTheme ? 'bg-black/30 border-white/10' : 'bg-muted'}`}>
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isLuxuryTheme ? 'hover:bg-white/10 text-white' : 'hover:bg-background'
                            }`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className={`w-12 text-center text-lg font-medium ${isLuxuryTheme ? 'text-white' : ''}`}>{quantity}</span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isLuxuryTheme ? 'hover:bg-white/10 text-white' : 'hover:bg-background'
                            }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleAddToCart}
                          disabled={!product.in_stock || isAddingToCart}
                          className={`w-full py-4 rounded-xl font-medium text-lg flex items-center justify-center gap-3 transition-all relative overflow-hidden group ${!product.in_stock
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : isLuxuryTheme
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                        >
                          {isAddingToCart ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              {product.in_stock ? 'Add to Bag' : 'Out of Stock'}
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Effects Badges (if any) */}
                  {product.effects && product.effects.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <div className="flex flex-wrap gap-4">
                        {product.effects.map((effect, idx) => {
                          const iconName = effect.toLowerCase();
                          let IconComponent = Activity;

                          if (iconName.includes('sleep') || iconName.includes('night')) IconComponent = Moon;
                          else if (iconName.includes('happy') || iconName.includes('mood')) IconComponent = Smile;
                          else if (iconName.includes('energy') || iconName.includes('uplift')) IconComponent = Zap;
                          else if (iconName.includes('relax') || iconName.includes('calm')) IconComponent = Sun;
                          else if (iconName.includes('focus')) IconComponent = Target;
                          else if (iconName.includes('creat')) IconComponent = Lightbulb;

                          return (
                            <div key={idx} className="flex flex-col items-center gap-2 group">
                              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                                <IconComponent className="w-5 h-5 text-emerald-400" />
                              </div>
                              <span className="text-xs uppercase tracking-wider text-white/40 font-medium">{effect}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Trust Indicators */}
                  <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-white/60" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Fast Delivery</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-white/60" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Secure</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <RotateCcw className="w-4 h-4 text-white/60" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Returns</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Full Width Sections Below Main Grid */}
          <div className="mt-24 space-y-24">

            {/* Description & Reviews Tabs Overlay */}
            <div className={`rounded-3xl p-8 lg:p-12 ${isLuxuryTheme ? 'bg-white/5 border border-white/10 backdrop-blur-md' : 'bg-card border'}`}>
              <Tabs defaultValue="description" className="w-full">
                <TabsList className="w-full justify-start bg-transparent border-b border-white/10 p-0 h-auto mb-8">
                  <TabsTrigger
                    value="description"
                    className="text-lg px-8 py-4 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 transition-all"
                  >
                    Description
                  </TabsTrigger>
                  <TabsTrigger
                    value="reviews"
                    className="text-lg px-8 py-4 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 transition-all"
                  >
                    Reviews ({reviews.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="description" className="mt-0">
                  <div className={`prose max-w-none ${isLuxuryTheme ? 'prose-invert prose-p:text-white/70 prose-headings:text-white' : ''}`}>
                    {product.description ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
                    ) : (
                      <p className="text-white/50">No description available for this product.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="reviews" className="mt-0">
                  {reviews.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Star className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-xl font-medium text-white mb-2">No reviews yet</p>
                      <p className="text-white/50 mb-8">Be the first to share your experience with this product.</p>
                      {store && product && (
                        <ReviewForm
                          storeId={store.id}
                          productId={product.product_id}
                          productName={product.name}
                          primaryColor={store.primary_color || '#10b981'}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div>
                        {/* Rating Summary */}
                        <div className="flex items-center gap-8 mb-12 bg-white/5 p-8 rounded-2xl border border-white/5">
                          <div className="text-center">
                            <span className="text-6xl font-light text-white block">{averageRating.toFixed(1)}</span>
                            <div className="flex justify-center mt-2">
                              {renderStars(averageRating, 'w-5 h-5')}
                            </div>
                            <span className="text-sm text-white/40 mt-2 block">{reviews.length} ratings</span>
                          </div>
                          <div className="h-20 w-px bg-white/10" />
                          <div className="flex-1">
                            <h3 className="text-2xl font-light text-white mb-2">Customer Reviews</h3>
                            <p className="text-white/60 mb-6">95% of customers recommended this product</p>
                            {store && product && (
                              <ReviewForm
                                storeId={store.id}
                                productId={product.product_id}
                                productName={product.name}
                                primaryColor={store.primary_color || '#10b981'}
                              />
                            )}
                          </div>
                        </div>

                        {/* Recent Reviews */}
                        <div className="space-y-6">
                          {reviews.map((review) => (
                            <div key={review.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-purple-500/20 flex items-center justify-center text-white font-medium">
                                    {review.customer_name?.[0] || 'A'}
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      {review.customer_name || 'Anonymous'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      {renderStars(review.rating, 'w-3 h-3')}
                                      {review.is_verified_purchase && (
                                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-[10px] h-5 px-1.5">
                                          Verified
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs text-white/30">
                                  {formatSmartDate(review.created_at)}
                                </span>
                              </div>
                              {review.title && (
                                <p className="font-medium text-white/90 mb-2">{review.title}</p>
                              )}
                              <p className="text-white/60 leading-relaxed">{review.comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-light text-white">You May Also Like</h2>
                  <Link to={`/shop/${storeSlug}/products`} className="text-white/50 hover:text-white transition-colors">
                    View All
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {relatedProducts.map((relatedProduct) => (
                    <Link
                      key={relatedProduct.product_id}
                      to={`/shop/${storeSlug}/products/${relatedProduct.product_id}`}
                    >
                      <div className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/5 hover:border-emerald-500/50 transition-all duration-300 h-full hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/20">
                        <div className="aspect-[4/5] relative overflow-hidden">
                          {relatedProduct.image_url ? (
                            <img
                              src={relatedProduct.image_url}
                              alt={relatedProduct.name}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[0.2] group-hover:grayscale-0"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <Package className="w-12 h-12 text-white/10" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />
                          <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                            <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-lg shadow-emerald-900/50">
                              View Details
                            </Button>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="font-medium text-white line-clamp-1 mb-1 group-hover:text-emerald-400 transition-colors">
                            {relatedProduct.name}
                          </h3>
                          <div className="flex items-center justify-between">
                            <span className="text-white/60 text-sm">{relatedProduct.category}</span>
                            <span className="font-bold text-emerald-400">
                              {formatCurrency(relatedProduct.display_price)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Viewed */}
            <RecentlyViewedSection
              currentProductId={productId}
              className="py-12 border-t border-white/5"
            />
          </div>


          {/* Enhanced Mobile Sticky Add to Cart (kept as is) */}
          <EnhancedStickyAddToCart
            product={{
              product_id: product.product_id,
              name: product.name,
              display_price: product.display_price,
              compare_at_price: product.compare_at_price,
              in_stock: product.in_stock,
              image_url: product.image_url,
            }}
            primaryColor={store.primary_color}
            onAddToCart={async () => {
              handleAddToCart();
            }}
            onToggleWishlist={toggleWishlist}
            isWishlisted={isWishlisted}
          />
        </div>
      </div>

      {/* Image Zoom Dialog */}
      <Dialog open={showZoom} onOpenChange={setShowZoom}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Product Image</DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center min-h-[80vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white rounded-full"
              onClick={() => setShowZoom(false)}
            >
              <X className="w-6 h-6" />
            </Button>
            {allImages[selectedImage] && (
              <img
                src={allImages[selectedImage]}
                alt={product.name}
                className="max-h-[85vh] w-auto object-contain rounded-lg"
              />
            )}
            {allImages.length > 1 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                {allImages.map((_, index) => (
                  <button
                    key={index}
                    aria-label={`View image ${index + 1}`}
                    className={cn(
                      'w-2.5 h-2.5 rounded-full transition-all duration-300',
                      selectedImage === index ? 'bg-white w-8' : 'bg-white/30 hover:bg-white/50'
                    )}
                    onClick={() => setSelectedImage(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
