import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, RefreshCw, Eye, Check, AlertTriangle } from 'lucide-react';
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
  thc_content: number | null;
  cbd_content: number | null;
  is_visible: boolean;
  display_order: number;
  stock_quantity?: number;
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

  // Wishlist
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlist({ storeId });

  const {
    heading = "Our Collection",
    subheading = "Premium curated strains",
    show_search = true,
    max_products = 12
  } = content || {};

  const accentColor = styles?.accent_color || '#10b981';

  // Fetch products with error handling
  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ['luxury-products', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      try {
        const { data, error } = await supabase
          .rpc('get_marketplace_products' as any, { p_store_id: storeId });

        if (error) {
          logger.error('Failed to fetch luxury products', error, { storeId });
          throw error;
        }
        return (data as MarketplaceProduct[]) || [];
      } catch (err) {
        logger.error('Error in luxury products query', err, { storeId });
        throw err;
      }
    },
    enabled: !!storeId,
    retry: 2, // Retry failed requests up to 2 times
  });

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats;
  }, [products]);

  // Filter products
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

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    return filtered.slice(0, max_products);
  }, [products, searchQuery, selectedCategory, max_products]);

  const strainTypeColors: Record<string, string> = {
    'Indica': 'from-purple-400/20 to-purple-600/20 text-purple-300',
    'Sativa': 'from-blue-400/20 to-blue-600/20 text-blue-300',
    'Hybrid': 'from-emerald-400/20 to-emerald-600/20 text-emerald-300'
  };

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
        variant: product.strain_type // Default to strain type if no variants
      });

      // Show added state for 2 seconds
      setAddedProducts(prev => new Set(prev).add(product.product_id));

      // Show premium cart popup
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

      // Removed standard toast in favor of popup
    } catch (error) {
      logger.error('Quick add to cart failed', error, { productId: product.product_id });
      toast({
        title: "Failed to add",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleQuickView = (e: React.MouseEvent, product: MarketplaceProduct) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickViewProduct(product);
  };

  const handleQuickViewAddToCart = (product: MarketplaceProduct, quantity: number) => {
    try {
      addItem({
        productId: product.product_id,
        name: product.product_name,
        price: product.price,
        imageUrl: product.image_url,
        quantity,
        variant: product.strain_type
      });

      toast({
        title: "Added to cart",
        description: `${quantity}x ${product.product_name} has been added to your cart.`,
        duration: 3000,
      });
    } catch (error) {
      logger.error('Quick view add to cart failed', error, { productId: product.product_id });
      toast({
        title: "Failed to add",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="relative py-24 bg-black" id="products">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-white font-serif italic text-5xl md:text-6xl tracking-tight mb-4">
            {heading}
          </h2>
          <p className="text-white/50 text-lg font-light font-sans tracking-wide">
            {subheading}
          </p>
        </motion.div>

        {/* Search & Filters */}
        {show_search && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col md:flex-row gap-4 mb-12 max-w-3xl mx-auto"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 rounded-full h-12 focus:border-white/20 transition-all focus:bg-white/[0.05]"
              />
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-light transition-all ${!selectedCategory
                  ? 'bg-white text-black'
                  : 'bg-white/[0.02] text-white/60 border border-white/10 hover:border-white/20'
                  }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-light transition-all ${selectedCategory === cat
                    ? 'bg-white text-black'
                    : 'bg-white/[0.02] text-white/60 border border-white/10 hover:border-white/20'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Products Grid with error handling */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-96 rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-white/50 text-lg mb-4">Unable to load products</p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="text-white border-white/20 hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/50 text-lg">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => {
              const colorClass = strainTypeColors[product.strain_type] || strainTypeColors['Hybrid'];
              const cleanedName = cleanProductName(product.product_name);

              return (
                <motion.div
                  key={product.product_id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <Link
                    to={`/shop/${storeSlug}/product/${product.product_id}${isPreviewMode ? '?preview=true' : ''}`}
                    className="group block"
                  >
                    <div className="relative bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02]">
                      {/* Glow effect on hover */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at center, ${accentColor}10 0%, transparent 70%)`
                        }}
                      />

                      {/* Image container */}
                      <div className="relative h-64 overflow-hidden">
                        <ProductImage
                          src={product.image_url}
                          alt={cleanedName}
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                        {/* Strain type badge */}
                        {product.strain_type && (
                          <div className={`absolute top-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 z-10`}>
                            <span className="text-[10px] font-medium tracking-widest uppercase text-white/90">{product.strain_type}</span>
                          </div>
                        )}

                        {/* Stock Status Badge */}
                        {product.stock_quantity !== undefined && product.stock_quantity <= 0 && (
                          <div className="absolute top-4 left-4 mt-8 px-3 py-1 bg-red-500/80 backdrop-blur-xl rounded-full z-10">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-white">Sold Out</span>
                          </div>
                        )}
                        {product.stock_quantity !== undefined && product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                          <div className="absolute top-4 left-4 mt-8 px-3 py-1 bg-amber-500/80 backdrop-blur-xl rounded-full z-10 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-white" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-white">Low Stock</span>
                          </div>
                        )}

                        {/* Sold Out Overlay */}
                        {product.stock_quantity !== undefined && product.stock_quantity <= 0 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-5">
                            <span className="text-white/80 text-lg font-serif italic">Out of Stock</span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                          {/* Wishlist Button */}
                          <WishlistButton
                            isInWishlist={isInWishlist(product.product_id)}
                            onToggle={() => toggleWishlist({
                              productId: product.product_id,
                              name: product.product_name,
                              price: product.price,
                              imageUrl: product.image_url,
                            })}
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-all duration-300"
                          />

                          {/* Quick View Button */}
                          <button
                            onClick={(e) => handleQuickView(e, product)}
                            className="p-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/20"
                            title="Quick View"
                          >
                            <Eye className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        {/* Category */}
                        {product.category && (
                          <p className="text-white/40 text-[10px] font-light tracking-widest uppercase mb-2">
                            {product.category}
                          </p>
                        )}

                        {/* Name */}
                        <h3 className="text-white text-lg font-serif font-light tracking-tight mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                          {cleanedName}
                        </h3>

                        {/* THC/CBD */}
                        {(product.thc_content || product.cbd_content) && (
                          <div className="flex gap-3 mb-4 text-white/40 text-[10px] tracking-wider">
                            {product.thc_content && (
                              <span>THC: {product.thc_content}%</span>
                            )}
                            {product.cbd_content && (
                              <span>CBD: {product.cbd_content}%</span>
                            )}
                          </div>
                        )}

                        {/* Price & CTA */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div>
                            <div className="text-white/30 text-[10px] font-light tracking-wider uppercase mb-1">From</div>
                            <div className="text-white text-xl font-light font-serif italic">${product.price?.toFixed(2) || '0.00'}</div>
                          </div>

                          <Button
                            size="sm"
                            onClick={(e) => handleQuickAdd(e, product)}
                            disabled={product.stock_quantity !== undefined && product.stock_quantity <= 0}
                            className={`px-5 py-2 border-none rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 transform active:scale-95 shadow-lg shadow-white/5 min-w-[80px] ${addedProducts.has(product.product_id)
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : product.stock_quantity !== undefined && product.stock_quantity <= 0
                                ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed'
                                : 'bg-white text-black hover:bg-neutral-200'
                              }`}
                          >
                            {addedProducts.has(product.product_id) ? (
                              <><Check className="w-3 h-3 mr-1" /> Added</>
                            ) : product.stock_quantity !== undefined && product.stock_quantity <= 0 ? (
                              'Sold Out'
                            ) : (
                              <><Plus className="w-3 h-3 mr-1" /> Add</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* View All Button */}
        {products.length > max_products && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center mt-12"
          >
            <Link to={`/shop/${storeSlug}/products${isPreviewMode ? '?preview=true' : ''}`}>
              <Button
                variant="outline"
                className="px-10 py-4 h-auto text-white border-white/10 hover:border-white/30 hover:bg-white/5 rounded-full text-sm font-light tracking-widest uppercase transition-all duration-300"
              >
                View Collection
              </Button>
            </Link>
          </motion.div>
        )}
      </div>

      {/* Quick View Modal */}
      {/* Cart Preview Popup */}
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
        onAddToCart={handleQuickViewAddToCart}
        accentColor={accentColor}
      />
    </section>
  );
}
