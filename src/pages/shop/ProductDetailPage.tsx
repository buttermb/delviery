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
  Sun
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
  const { storeSlug, productId } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
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

  // Fetch product details
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['shop-product', store?.id, productId],
    queryFn: async () => {
      if (!store?.id || !productId) return null;

      try {
        const { data, error } = await supabase
          .rpc('get_marketplace_products', { p_store_id: store.id });

        if (error) {
          logger.error('Failed to fetch product', error);
          return null;
        }

        const products = (data || []).map((item: RpcProduct) => transformProduct(item));
        return products.find((p: ProductDetails) => p.product_id === productId) || null;
      } catch (err) {
        logger.error('Error fetching product', err);
        return null;
      }
    },
    enabled: !!store?.id && !!productId,
  });

  // Fetch product reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['product-reviews', store?.id, productId],
    queryFn: async () => {
      if (!store?.id || !productId) return [];

      const { data, error } = await supabase
        .from('marketplace_reviews')
        .select('*')
        .eq('store_id', store.id)
        .eq('product_id', productId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ProductReview[];
    },
    enabled: !!store?.id && !!productId,
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
        .filter((p: ProductDetails) => p.product_id !== productId && p.category === product.category)
        .slice(0, 4);
    },
    enabled: !!store?.id && !!product?.category,
  });

  // Check wishlist status
  useEffect(() => {
    if (store?.id && productId) {
      const wishlist = JSON.parse(localStorage.getItem(`shop_wishlist_${store.id}`) || '[]');
      setIsWishlisted(wishlist.includes(productId));
    }
  }, [store?.id, productId]);

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
      if (productId) {
        addToRecentlyViewed(productId);
      }

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

    // Toast removed in favor of popup
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
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb Skeleton */}
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Skeleton */}
          <div>
            <Skeleton className="aspect-square rounded-lg w-full" />
          </div>

          {/* Info Skeleton */}
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" /> {/* Title */}
              <Skeleton className="h-5 w-1/3" /> {/* Ratings */}
              <Skeleton className="h-12 w-1/4" /> {/* Price */}
            </div>

            <Separator className="opacity-50" />

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* Variants */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-16" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-20 rounded-md" />
                <Skeleton className="h-10 w-20 rounded-md" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-20" /> {/* Quantity label */}
                <Skeleton className="h-10 w-32 rounded-lg" /> {/* Quantity selector */}
              </div>
              <Skeleton className="h-14 w-full rounded-lg" /> {/* Add to Cart */}
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
    <>
      {/* Scroll Progress Bar */}
      <ScrollProgress color={accentColor} />

      {/* Cart Preview Popup */}
      <CartPreviewPopup
        item={lastAddedItem}
        cartCount={cartCount}
        cartTotal={subtotal}
        storeSlug={storeSlug || ''}
        onClose={() => setLastAddedItem(null)}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link
            to={`/shop/${storeSlug}`}
            className="text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link
            to={`/shop/${storeSlug}/products`}
            className="text-muted-foreground hover:text-foreground"
          >
            Products
          </Link>
          {product.category && (
            <>
              <span className="text-muted-foreground">/</span>
              <Link
                to={`/shop/${storeSlug}/products?category=${encodeURIComponent(product.category)}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {product.marketplace_category_name || product.category}
              </Link>
            </>
          )}
          <span className="text-muted-foreground">/</span>
          <span className="truncate">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div
              className="aspect-square relative bg-muted rounded-lg overflow-hidden cursor-zoom-in group"
              onClick={() => setShowZoom(true)}
            >
              <AnimatePresence mode="wait">
                {allImages[selectedImage] ? (
                  <motion.img
                    key={selectedImage}
                    src={allImages[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-24 h-24 text-muted-foreground" />
                  </div>
                )}
              </AnimatePresence>

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {hasDiscount && (
                  <Badge style={{ backgroundColor: store.primary_color }}>
                    -{discountPercent}% OFF
                  </Badge>
                )}
                {!product.in_stock && (
                  <Badge variant="secondary">Out of Stock</Badge>
                )}
                {product.is_featured && (
                  <Badge variant="outline" className="bg-white">
                    Featured
                  </Badge>
                )}
              </div>

              {/* Zoom Icon */}
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/90 rounded-full p-2">
                  <ZoomIn className="w-5 h-5" />
                </div>
              </div>

              {/* Navigation Arrows */}
              {allImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
                    }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
                    }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, index) => (
                  <button
                    key={index}
                    className={cn(
                      'w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                      selectedImage === index
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    )}
                    style={{
                      borderColor: selectedImage === index ? store.primary_color : undefined,
                    }}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Rating */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.name}</h1>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2">
                  {renderStars(averageRating)}
                  <span className="text-sm text-muted-foreground">
                    ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
              {product.sku && (
                <p className="text-sm text-muted-foreground mt-1">SKU: {product.sku}</p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span
                className="text-3xl font-bold"
                style={{ color: store.primary_color }}
              >
                {formatCurrency(product.display_price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-muted-foreground line-through">
                    {formatCurrency(product.compare_at_price!)}
                  </span>
                  <Badge variant="destructive">Save {discountPercent}%</Badge>
                </>
              )}
            </div>

            {/* Short Description */}
            {product.short_description && (
              <p className="text-muted-foreground">{product.short_description}</p>
            )}

            {/* Effects */}
            {product.effects && product.effects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.effects.map((effect, idx) => {
                  const iconName = effect.toLowerCase();
                  let IconComponent = Activity; // Default

                  if (iconName.includes('sleep') || iconName.includes('night')) IconComponent = Moon;
                  else if (iconName.includes('happy') || iconName.includes('mood')) IconComponent = Smile;
                  else if (iconName.includes('energy') || iconName.includes('uplift')) IconComponent = Zap;
                  else if (iconName.includes('relax') || iconName.includes('calm')) IconComponent = Sun;
                  else if (iconName.includes('focus')) IconComponent = Target;
                  else if (iconName.includes('creat')) IconComponent = Lightbulb;

                  return (
                    <TooltipProvider key={idx}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-sm backdrop-blur-sm">
                            <IconComponent className="w-4 h-4 text-primary" style={{ color: store.primary_color }} />
                            <span className="capitalize">{effect}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {effect} effect
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            )}

            <Separator />

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-3">
                <p className="font-medium">Options</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant: any) => (
                    <Button
                      key={variant.name || variant}
                      variant={selectedVariant === (variant.name || variant) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedVariant(variant.name || variant)}
                      style={{
                        backgroundColor:
                          selectedVariant === (variant.name || variant)
                            ? store.primary_color
                            : undefined,
                      }}
                    >
                      {variant.name || variant}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Real-time Stock Warning */}
            <StockWarning
              productId={product.product_id}
              requested={quantity}
              variant="inline"
            />

            {/* Quantity */}
            <div className="space-y-3">
              <p className="font-medium">Quantity</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-r-none"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-l-none"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 99}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {!product.in_stock && (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>
            </div>

            {/* Add to Cart & Wishlist */}
            <div className="flex gap-3">
              <motion.div
                className="flex-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  data-testid="add-to-cart-button"
                  size="lg"
                  className="w-full relative overflow-hidden"
                  style={{ backgroundColor: store.primary_color }}
                  disabled={!product.in_stock || isAddingToCart}
                  onClick={handleAddToCart}
                >
                  {isAddingToCart && !showAddedAnimation ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </span>
                  ) : showAddedAnimation ? (
                    <span className="flex items-center gap-2">
                      <Check className="w-5 h-5" />
                      Added!
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      {product.in_stock ? 'Add to Cart' : 'Out of Stock'}
                    </span>
                  )}
                </Button>
              </motion.div>
              <Button
                size="lg"
                variant="outline"
                className={cn(isWishlisted && 'text-red-500 border-red-500')}
                onClick={toggleWishlist}
              >
                <Heart className={cn('w-5 h-5', isWishlisted && 'fill-red-500')} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" variant="outline">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleShare('copy')}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('facebook')}>
                    <Facebook className="w-4 h-4 mr-2" />
                    Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('twitter')}>
                    <Twitter className="w-4 h-4 mr-2" />
                    Twitter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="flex flex-col items-center text-center">
                <Truck className="w-6 h-6 mb-1" style={{ color: store.primary_color }} />
                <span className="text-xs text-muted-foreground">Fast Delivery</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Shield className="w-6 h-6 mb-1" style={{ color: store.primary_color }} />
                <span className="text-xs text-muted-foreground">Secure Payment</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <RotateCcw className="w-6 h-6 mb-1" style={{ color: store.primary_color }} />
                <span className="text-xs text-muted-foreground">Easy Returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-12">
          <Tabs defaultValue="description">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews ({reviews.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card>
                <CardContent className="pt-6 prose max-w-none">
                  {product.description ? (
                    <div dangerouslySetInnerHTML={{ __html: product.description }} />
                  ) : (
                    <p className="text-muted-foreground">No description available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {reviews.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No reviews yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Be the first to review this product
                      </p>
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
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-6 border-b">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-4xl font-bold">{averageRating.toFixed(1)}</p>
                            {renderStars(averageRating, 'w-5 h-5')}
                            <p className="text-sm text-muted-foreground mt-1">
                              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        {store && product && (
                          <ReviewForm
                            storeId={store.id}
                            productId={product.product_id}
                            productName={product.name}
                            primaryColor={store.primary_color || '#10b981'}
                          />
                        )}
                      </div>

                      {/* Review List */}
                      <div className="space-y-6">
                        {reviews.map((review) => (
                          <div key={review.id} className="border-b pb-6 last:border-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">
                                    {review.customer_name || 'Anonymous'}
                                  </p>
                                  {review.is_verified_purchase && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Check className="w-3 h-3 mr-1" />
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                {renderStars(review.rating)}
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {formatSmartDate(review.created_at)}
                              </span>
                            </div>
                            {review.title && (
                              <p className="font-medium mt-2">{review.title}</p>
                            )}
                            {review.comment && (
                              <p className="text-muted-foreground mt-1">{review.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.product_id}
                  to={`/shop/${storeSlug}/products/${relatedProduct.product_id}`}
                >
                  <Card className="group hover:shadow-lg transition-all overflow-hidden h-full">
                    <div className="aspect-square relative overflow-hidden bg-muted">
                      {relatedProduct.image_url ? (
                        <img
                          src={relatedProduct.image_url}
                          alt={relatedProduct.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                        {relatedProduct.name}
                      </h3>
                      <p className="font-bold" style={{ color: store.primary_color }}>
                        {formatCurrency(relatedProduct.display_price)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Image Zoom Dialog */}
        <Dialog open={showZoom} onOpenChange={setShowZoom}>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Product Image</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-white/80"
                onClick={() => setShowZoom(false)}
              >
                <X className="w-5 h-5" />
              </Button>
              {allImages[selectedImage] && (
                <img
                  src={allImages[selectedImage]}
                  alt={product.name}
                  className="w-full h-auto"
                />
              )}
              {allImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {allImages.map((_, index) => (
                    <button
                      key={index}
                      aria-label={`View image ${index + 1}`}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all',
                        selectedImage === index ? 'bg-white w-4' : 'bg-white/50'
                      )}
                      onClick={() => setSelectedImage(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Recently Viewed Products */}
        <RecentlyViewedSection
          currentProductId={productId}
          className="mt-16"
        />

        {/* Enhanced Mobile Sticky Add to Cart */}
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
    </>
  );
}
