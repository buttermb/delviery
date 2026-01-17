import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { 
  Shield, ShoppingCart, Package, Minus, Plus, Lock, 
  ZoomIn, Leaf, Sparkles, Wind, Coffee, Search, X, Check,
  ChevronRight
} from 'lucide-react';
import { showSuccessToast } from '@/utils/toastHelpers';
import { OptimizedProductImage } from '@/components/OptimizedProductImage';
import { trackImageZoom } from '@/hooks/useMenuAnalytics';
import { getDefaultWeight, sortProductWeights, formatWeight } from '@/utils/productHelpers';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ModernCheckoutFlow } from '@/components/menu/ModernCheckoutFlow';

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  prices?: Record<string, number>;
  category?: string;
  image_url?: string;
  images?: string[];
  quantity_lbs?: number;
  strain_type?: 'Indica' | 'Sativa' | 'Hybrid' | 'CBD';
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: Array<{ name: string; percentage: number }>;
  effects?: string[];
  flavors?: string[];
  lineage?: string;
  grow_info?: string;
}

interface MenuData {
  menu_id: string;
  whitelist_id?: string;
  name: string;
  description?: string;
  products: Product[];
  appearance_settings?: {
    show_product_images?: boolean;
    show_availability?: boolean;
  };
  min_order_quantity?: number;
  max_order_quantity?: number;
  custom_prices?: Record<string, number>;
}

const STRAIN_TYPES = ['All', 'Indica', 'Sativa', 'Hybrid', 'CBD'] as const;
const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'thc', label: 'THC %' },
] as const;

const getStrainColor = (strainType?: string) => {
  switch (strainType) {
    case 'Indica': return 'bg-purple-500 text-white';
    case 'Sativa': return 'bg-emerald-500 text-white';
    case 'Hybrid': return 'bg-orange-500 text-white';
    case 'CBD': return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getStrainBgColor = (strainType?: string) => {
  switch (strainType) {
    case 'Indica': return 'from-purple-500/20 to-purple-600/10';
    case 'Sativa': return 'from-emerald-500/20 to-emerald-600/10';
    case 'Hybrid': return 'from-orange-500/20 to-orange-600/10';
    case 'CBD': return 'from-blue-500/20 to-blue-600/10';
    default: return 'from-gray-500/20 to-gray-600/10';
  }
};

const getEffectIcon = (effect: string) => {
  const lowerEffect = effect.toLowerCase();
  if (lowerEffect.includes('relax') || lowerEffect.includes('calm')) return '😌';
  if (lowerEffect.includes('energe') || lowerEffect.includes('upli')) return '⚡';
  if (lowerEffect.includes('creative') || lowerEffect.includes('focus')) return '🎨';
  if (lowerEffect.includes('happy') || lowerEffect.includes('euphori')) return '😊';
  if (lowerEffect.includes('sleep') || lowerEffect.includes('sedat')) return '😴';
  if (lowerEffect.includes('hungry') || lowerEffect.includes('munch')) return '🍕';
  return '✨';
};

// Enhanced Product Card Component
function ProductCard({ 
  product, 
  menuData,
  selectedWeight,
  onWeightChange,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onViewDetails,
  onImageZoom
}: {
  product: Product;
  menuData: MenuData;
  selectedWeight: string;
  onWeightChange: (weight: string) => void;
  cartQuantity: number;
  onAddToCart: () => void;
  onUpdateQuantity: (delta: number) => void;
  onViewDetails: () => void;
  onImageZoom: () => void;
}) {
  const [justAdded, setJustAdded] = useState(false);
  const shouldShowImage = menuData.appearance_settings?.show_product_images !== false;
  const imageUrl = product.image_url || product.images?.[0];
  
  const hasPrices = product.prices && typeof product.prices === 'object';
  const weights = hasPrices ? sortProductWeights(Object.keys(product.prices!)) : [];
  const currentPrice = hasPrices 
    ? (product.prices![selectedWeight] || 0)
    : (product.price || 0);

  const handleAddToCart = () => {
    onAddToCart();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-colors duration-300 group",
      "hover:shadow-xl hover:shadow-primary/10",
      justAdded && "ring-2 ring-emerald-500 ring-offset-2"
    )}>
      {/* Image Section */}
      <div className="relative">
        {shouldShowImage && imageUrl && (
          <div 
            className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/50 cursor-pointer"
            onClick={onImageZoom}
          >
            <OptimizedProductImage
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="secondary" className="h-8 gap-1">
                <ZoomIn className="h-3.5 w-3.5" />
                View
              </Button>
            </div>
          </div>
        )}
        
        {/* Strain Badge */}
        {product.strain_type && (
          <Badge className={cn(
            "absolute top-3 left-3 font-semibold shadow-lg",
            getStrainColor(product.strain_type)
          )}>
            {product.strain_type}
          </Badge>
        )}

        {/* THC Badge */}
        {product.thc_percentage && (
          <Badge 
            variant="secondary" 
            className="absolute top-3 right-3 bg-black/70 text-white backdrop-blur-sm"
          >
            <Leaf className="h-3 w-3 mr-1" />
            {product.thc_percentage.toFixed(1)}%
          </Badge>
        )}

        {/* Added Indicator */}
        {justAdded && (
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
            <div className="bg-emerald-500 text-white rounded-full p-3 animate-bounce">
              <Check className="h-6 w-6" />
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className={cn(
        "p-4 space-y-3",
        product.strain_type && `bg-gradient-to-b ${getStrainBgColor(product.strain_type)}`
      )}>
        {/* Title & Info Button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {product.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onViewDetails}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>

        {/* Effects */}
        {product.effects && product.effects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.effects.slice(0, 3).map((effect, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs py-0.5">
                {getEffectIcon(effect)} {effect}
              </Badge>
            ))}
          </div>
        )}

        {/* Weight Selector */}
        {hasPrices && weights.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {weights.map(weight => (
              <Button
                key={weight}
                size="sm"
                variant={selectedWeight === weight ? 'default' : 'outline'}
                onClick={() => onWeightChange(weight)}
                className={cn(
                  "h-9 px-3 text-sm font-medium transition-colors",
                  selectedWeight === weight && "shadow-md"
                )}
              >
                {formatWeight(weight)}
              </Button>
            ))}
          </div>
        )}

        {/* Price & Stock */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-2xl font-bold text-primary">
            ${currentPrice.toFixed(2)}
          </div>
          {menuData.appearance_settings?.show_availability !== false && product.quantity_lbs && (
            <Badge variant="outline" className="text-xs">
              <Package className="h-3 w-3 mr-1" />
              {product.quantity_lbs} lbs
            </Badge>
          )}
        </div>

        {/* Add to Cart / Quantity Controls */}
        {cartQuantity === 0 ? (
          <Button 
            onClick={handleAddToCart}
            className="w-full h-12 text-base font-semibold gap-2"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add to Cart
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={() => onUpdateQuantity(-1)}
              className="h-12 w-12 p-0"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">{cartQuantity}</div>
              <div className="text-xs text-muted-foreground">in cart</div>
            </div>
            <Button
              size="lg"
              onClick={() => onUpdateQuantity(1)}
              className="h-12 w-12 p-0"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}


const SecureMenuView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<Record<string, string>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrain, setSelectedStrain] = useState<typeof STRAIN_TYPES[number]>('All');
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]['value']>('name');

  // Use Zustand cart store
  const cartItems = useMenuCartStore((state) => state.items);
  const addItem = useMenuCartStore((state) => state.addItem);
  const removeItem = useMenuCartStore((state) => state.removeItem);
  const updateQuantityStore = useMenuCartStore((state) => state.updateQuantity);
  const clearCart = useMenuCartStore((state) => state.clearCart);
  const setMenuToken = useMenuCartStore((state) => state.setMenuToken);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);

  const cleanupScreenshotProtection = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Check session storage for validated menu access
    const storedMenu = sessionStorage.getItem(`menu_${token}`);
    if (storedMenu) {
      const parsed = JSON.parse(storedMenu);
      
      // Check if this is a forum menu and redirect
      if (parsed.security_settings?.menu_type === 'forum') {
        const forumUrl = parsed.security_settings?.forum_url || '/community';
        navigate(forumUrl);
        return;
      }
      
      setMenuData(parsed);
      setLoading(false);

      // Set menu token in cart store for persistence
      if (token) {
        setMenuToken(token);
      }

      return () => {
        if (cleanupScreenshotProtection.current) {
          cleanupScreenshotProtection.current();
        }
      };
    } else {
      // Redirect back to access page if not validated
      navigate(`/m/${token}`);
    }
  }, [token, navigate, setMenuToken]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    if (!menuData?.products) return [];
    
    let products = [...menuData.products];
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.effects?.some(e => e.toLowerCase().includes(query)) ||
        p.flavors?.some(f => f.toLowerCase().includes(query))
      );
    }
    
    // Filter by strain type
    if (selectedStrain !== 'All') {
      products = products.filter(p => p.strain_type === selectedStrain);
    }
    
    // Sort
    products.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-low':
          return (getProductPrice(a) || 0) - (getProductPrice(b) || 0);
        case 'price-high':
          return (getProductPrice(b) || 0) - (getProductPrice(a) || 0);
        case 'thc':
          return (b.thc_percentage || 0) - (a.thc_percentage || 0);
        default:
          return 0;
      }
    });
    
    return products;
  }, [menuData?.products, searchQuery, selectedStrain, sortBy]);

  const getProductPrice = (product: Product, weight?: string) => {
    if (product.prices && typeof product.prices === 'object') {
      const selectedWeight = weight || selectedWeights[product.id] || getDefaultWeight(product.prices);
      return product.prices[selectedWeight] || 0;
    }
    return product.price || 0;
  };

  const handleAddToCart = (product: Product) => {
    const weight = selectedWeights[product.id] || getDefaultWeight(product.prices);
    const price = getProductPrice(product, weight);
    
    addItem({
      productId: product.id,
      weight,
      price,
      productName: product.name,
    });
    
    toast.success(`${product.name} added to cart`);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const existingItem = cartItems.find(item => item.productId === productId);
    if (!existingItem) return;
    
    const newQty = existingItem.quantity + delta;
    if (newQty <= 0) {
      removeItem(productId);
    } else {
      updateQuantityStore(productId, newQty);
    }
  };

  const handleOrderComplete = () => {
    showSuccessToast('Order Placed', 'Your order has been submitted successfully');
    clearCart();
    setSelectedWeights({});
    
    // Clear session after order
    setTimeout(() => {
      sessionStorage.removeItem(`menu_${token}`);
      navigate('/');
    }, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!menuData) {
    return null;
  }

  const totalItems = getItemCount();
  const totalAmount = getTotal();
  const cartMap = new Map(cartItems.map(item => [item.productId, item]));

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-lg border-b sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{menuData.name}</h1>
              {menuData.description && (
                <p className="text-sm text-muted-foreground truncate">{menuData.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:flex items-center gap-1 shrink-0">
                <Shield className="h-3 w-3" />
                Encrypted
              </Badge>
              
              {/* Cart Button */}
              <Button
                variant="default"
                size="lg"
                className="relative gap-2"
                onClick={() => setCheckoutOpen(true)}
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden sm:inline">Cart</span>
                {totalItems > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center bg-red-500">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Security Notice */}
        <Alert className="bg-primary/5 border-primary/20">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            This is a confidential catalog. Do not share or screenshot this page.
          </AlertDescription>
        </Alert>

        {/* Filters Bar */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products, effects, flavors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Strain Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {STRAIN_TYPES.map((strain) => (
              <Button
                key={strain}
                variant={selectedStrain === strain ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStrain(strain)}
                className={cn(
                  "shrink-0 h-9 px-4",
                  selectedStrain === strain && strain !== 'All' && getStrainColor(strain)
                )}
              >
                {strain}
              </Button>
            ))}
            
            {/* Sort Dropdown */}
            <div className="ml-auto shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                {searchQuery || selectedStrain !== 'All' 
                  ? 'No products match your filters'
                  : 'No products available in this menu'}
              </p>
              {(searchQuery || selectedStrain !== 'All') && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStrain('All');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            filteredProducts.map((product) => {
              const cartItem = cartMap.get(product.id);
              const selectedWeight = selectedWeights[product.id] || getDefaultWeight(product.prices);
              
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  menuData={menuData}
                  selectedWeight={selectedWeight}
                  onWeightChange={(weight) => setSelectedWeights(prev => ({ ...prev, [product.id]: weight }))}
                  cartQuantity={cartItem?.quantity || 0}
                  onAddToCart={() => handleAddToCart(product)}
                  onUpdateQuantity={(delta) => handleUpdateQuantity(product.id, delta)}
                  onViewDetails={() => setSelectedProduct(product)}
                  onImageZoom={() => {
                    const imageUrl = product.image_url || product.images?.[0];
                    if (imageUrl) {
                      setZoomedImage({ url: imageUrl, name: product.name });
                      trackImageZoom(menuData.menu_id, product.id);
                    }
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Floating Cart Summary */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t shadow-2xl p-4 z-30 safe-area-inset-bottom">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                {totalItems} item{totalItems !== 1 ? 's' : ''}
              </div>
              <div className="text-2xl font-bold text-primary">
                ${totalAmount.toFixed(2)}
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => setCheckoutOpen(true)}
              className="min-w-[160px] h-12 text-base font-semibold gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              View Cart
            </Button>
          </div>
        </div>
      )}

      {/* Modern Checkout Flow */}
      <ModernCheckoutFlow
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        menuId={menuData.menu_id}
        accessToken={menuData.whitelist_id}
        minOrder={menuData.min_order_quantity}
        maxOrder={menuData.max_order_quantity}
        onOrderComplete={handleOrderComplete}
        products={menuData.products.map(p => ({ id: p.id, name: p.name, image_url: p.image_url }))}
      />

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">{zoomedImage?.name}</DialogTitle>
          {zoomedImage && (
            <div className="relative">
              <div className="absolute top-4 left-4 z-10">
                <Badge variant="secondary" className="text-lg px-4 py-2 backdrop-blur-sm">
                  {zoomedImage.name}
                </Badge>
              </div>
              <OptimizedProductImage
                src={zoomedImage.url}
                alt={zoomedImage.name}
                className="w-full h-auto"
                priority={true}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedProduct?.name}</DialogTitle>
            {selectedProduct?.strain_type && (
              <Badge className={cn("w-fit font-semibold", getStrainColor(selectedProduct.strain_type))}>
                {selectedProduct.strain_type}
              </Badge>
            )}
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-6">
              {/* Image */}
              {(selectedProduct.image_url || selectedProduct.images?.[0]) && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <OptimizedProductImage
                    src={selectedProduct.image_url || selectedProduct.images![0]}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                    priority={true}
                  />
                </div>
              )}

              {/* Price Range */}
              {selectedProduct.prices && typeof selectedProduct.prices === 'object' && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Available Sizes
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedProduct.prices).map(([weight, price]) => (
                      <div key={weight} className="flex justify-between p-3 bg-muted rounded-lg">
                        <span className="font-medium">{formatWeight(weight)}</span>
                        <span className="text-primary font-bold">${(price as number).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lineage */}
              {selectedProduct.lineage && (
                <div>
                  <h4 className="font-semibold mb-2">Lineage</h4>
                  <p className="text-muted-foreground">{selectedProduct.lineage}</p>
                </div>
              )}

              {/* THC/CBD Content */}
              {(selectedProduct.thc_percentage || selectedProduct.cbd_percentage) && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Leaf className="h-4 w-4" />
                    Cannabinoid Profile
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedProduct.thc_percentage && (
                      <div className="p-4 bg-emerald-500/10 rounded-lg">
                        <div className="text-3xl font-bold text-emerald-600">
                          {selectedProduct.thc_percentage.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">THC</div>
                      </div>
                    )}
                    {selectedProduct.cbd_percentage && (
                      <div className="p-4 bg-blue-500/10 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">
                          {selectedProduct.cbd_percentage.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">CBD</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Terpene Profile */}
              {selectedProduct.terpenes && selectedProduct.terpenes.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Wind className="h-4 w-4" />
                    Terpene Profile
                  </h4>
                  <div className="space-y-2">
                    {selectedProduct.terpenes.map((terpene, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm">{terpene.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${Math.min(terpene.percentage * 50, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {terpene.percentage.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Effects */}
              {selectedProduct.effects && selectedProduct.effects.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Effects
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.effects.map((effect, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm py-1 px-3">
                        {getEffectIcon(effect)} {effect}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Flavors */}
              {selectedProduct.flavors && selectedProduct.flavors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Coffee className="h-4 w-4" />
                    Flavor Profile
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.flavors.map((flavor, idx) => (
                      <Badge key={idx} variant="outline" className="text-sm">
                        {flavor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedProduct.description && (
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {/* Add to Cart from Detail View */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => {
                    handleAddToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="w-full h-12 text-lg font-semibold"
                  size="lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecureMenuView;
