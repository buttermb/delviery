import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { Shield, ShoppingCart, Package, Minus, Plus, Lock, AlertTriangle, ZoomIn, Leaf, Sparkles, Wind, Coffee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { OptimizedProductImage } from '@/components/OptimizedProductImage';
import { ProductImageGallery } from '@/components/customer/ProductImageGallery';
// import { enableScreenshotProtection, generateDeviceFingerprint } from '@/utils/screenshotProtection';
import { trackImageZoom } from '@/hooks/useMenuAnalytics';
import { getDefaultWeight, sortProductWeights, formatWeight } from '@/utils/productHelpers';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { toast } from 'sonner';

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

const getStrainColor = (strainType?: string) => {
  switch (strainType) {
    case 'Indica': return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
    case 'Sativa': return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20';
    case 'Hybrid': return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20';
    case 'CBD': return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
    default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20';
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

const SecureMenuView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<Record<string, string>>({});

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

      // Enable screenshot protection if enabled in menu settings (disabled - module removed)
      // if (parsed.security_settings?.screenshot_protection?.enabled) {
      //   generateDeviceFingerprint().then((fingerprint) => {
      //     cleanupScreenshotProtection.current = enableScreenshotProtection(
      //       parsed.menu_id,
      //       parsed.whitelist_id,
      //       (event) => {
      //         console.log('Security event detected:', event);
      //       }
      //     );
      //   });
      // }

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

  const getProductPrice = (product: Product, weight?: string) => {
    if (product.prices && typeof product.prices === 'object') {
      const selectedWeight = weight || selectedWeights[product.id] || getDefaultWeight(product.prices);
      return product.prices[selectedWeight] || 0;
    }
    return product.price || 0;
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = menuData?.products?.find((p: Product) => p.id === productId);
    if (!product) return;

    const existingItem = cartItems.find(item => item.productId === productId);
    const currentQty = existingItem?.quantity || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    const weight = selectedWeights[productId] || getDefaultWeight(product.prices);
    const price = getProductPrice(product, weight);

    if (newQty === 0) {
      removeItem(productId);
    } else if (existingItem) {
      updateQuantityStore(productId, newQty);
    } else {
      addItem({
        productId,
        weight,
        price,
        productName: product.name,
      });
      // Then update to the correct quantity if needed
      if (newQty > 1) {
        updateQuantityStore(productId, newQty);
      }
    }
  };

  const calculateTotal = () => {
    return getTotal();
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;

    // Get contact phone
    const contact_phone = prompt("Enter your contact phone number for order updates:");
    if (!contact_phone?.trim()) {
      toast.error('Phone number is required to place an order');
      return;
    }

    setPlacingOrder(true);
    try {
      const orderItems = cartItems.map(item => {
        const product = menuData!.products.find((p: Product) => p.id === item.productId);
        return {
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
          weight: item.weight
        };
      });

      const { data, error } = await supabase.functions.invoke('menu-order-place', {
        body: {
          menu_id: menuData!.menu_id,
          access_token: menuData!.whitelist_id,
          order_items: orderItems,
          contact_phone: contact_phone.trim(),
          delivery_method: 'pickup',
          payment_method: 'cash',
          delivery_address: '',
          customer_notes: ''
        }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to place order';
        throw new Error(errorMessage);
      }

      showSuccessToast('Order Placed', 'Your order has been submitted successfully');
      clearCart();
      setSelectedWeights({});
      
      // Clear session after order
      setTimeout(() => {
        sessionStorage.removeItem(`menu_${token}`);
        navigate('/');
      }, 2000);
    } catch (err: unknown) {
      logger.error('Order error', err, { component: 'SecureMenuView' });
      const errorMessage = err instanceof Error ? err.message : 'Could not place order';
      showErrorToast('Order Failed', errorMessage);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!menuData) {
    return null;
  }

  const totalItems = getItemCount();
  const totalAmount = calculateTotal();
  
  // Convert cart items to a map for easier lookup
  const cartMap = new Map(cartItems.map(item => [item.productId, item]));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{menuData.name}</h1>
              <p className="text-sm text-muted-foreground">{menuData.description}</p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Encrypted
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Security Notice */}
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            This is a confidential catalog. Do not share or screenshot this page.
          </AlertDescription>
        </Alert>

        {/* Order Constraints */}
        {(menuData.min_order_quantity || menuData.max_order_quantity) && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {menuData.min_order_quantity && `Minimum order: ${menuData.min_order_quantity} items. `}
              {menuData.max_order_quantity && `Maximum order: ${menuData.max_order_quantity} items.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {!menuData.products || menuData.products.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No products available in this menu</p>
            </div>
          ) : (
            menuData.products.map((product: Product) => {
              const cartItem = cartMap.get(product.id);
              const quantity = cartItem?.quantity || 0;
              const shouldShowImage = menuData.appearance_settings?.show_product_images !== false;
              const imageUrl = product.image_url || product.images?.[0];
              
              const hasPrices = product.prices && typeof product.prices === 'object';
              const selectedWeight = selectedWeights[product.id] || getDefaultWeight(product.prices);
              const currentPrice = getProductPrice(product, selectedWeight);
              
              const weights = hasPrices ? sortProductWeights(Object.keys(product.prices!)) : [];

              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    {/* Product Image */}
                    {shouldShowImage && imageUrl && (
                      <div 
                        className="relative aspect-square overflow-hidden bg-muted cursor-pointer group"
                        onClick={() => {
                          setZoomedImage({ url: imageUrl, name: product.name });
                          trackImageZoom(menuData.menu_id, product.id);
                        }}
                      >
                        <OptimizedProductImage
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          priority={false}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    
                    {/* Strain Badge Overlay */}
                    {product.strain_type && (
                      <Badge className={`absolute top-3 left-3 ${getStrainColor(product.strain_type)} font-semibold`}>
                        {product.strain_type}
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Product Info */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-lg leading-tight">{product.name}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProduct(product)}
                          className="h-8 px-2"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* THC/CBD Badges */}
                      {(product.thc_percentage || product.cbd_percentage) && (
                        <div className="flex gap-2 mb-2">
                          {product.thc_percentage && (
                            <Badge variant="outline" className="text-xs">
                              <Leaf className="h-3 w-3 mr-1" />
                              {product.thc_percentage.toFixed(1)}% THC
                            </Badge>
                          )}
                          {product.cbd_percentage && product.cbd_percentage > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {product.cbd_percentage.toFixed(1)}% CBD
                            </Badge>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description || 'Premium cannabis flower'}
                      </p>
                    </div>

                    {/* Effects */}
                    {product.effects && product.effects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.effects.slice(0, 4).map((effect, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {getEffectIcon(effect)} {effect}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Weight Selector */}
                    {hasPrices && weights.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {weights.map(weight => (
                          <Button
                            key={weight}
                            size="sm"
                            variant={selectedWeight === weight ? 'default' : 'outline'}
                            onClick={() => {
                              setSelectedWeights(prev => ({ ...prev, [product.id]: weight }));
                            }}
                            className="text-xs h-8"
                          >
                            {formatWeight(weight)}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Price and Stock */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xl font-bold text-primary">
                        ${currentPrice.toFixed(2)}
                      </div>
                      {menuData.appearance_settings?.show_availability !== false && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {product.quantity_lbs || 0} lbs
                        </Badge>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(product.id, -1)}
                        disabled={quantity === 0}
                        className="h-9 w-9 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const weight = selectedWeights[product.id] || getDefaultWeight(product.prices);
                          const price = getProductPrice(product, weight);
                          
                          if (val === 0) {
                            removeItem(product.id);
                          } else {
                            const existingItem = cartItems.find(item => item.productId === product.id);
                            if (existingItem) {
                              updateQuantityStore(product.id, val);
                            } else {
                              addItem({
                                productId: product.id,
                                weight,
                                price,
                                productName: product.name,
                              });
                              if (val > 1) {
                                updateQuantityStore(product.id, val);
                              }
                            }
                          }
                        }}
                        className="flex-1 text-center h-9"
                        min={0}
                      />
                      <Button
                        size="sm"
                        onClick={() => updateQuantity(product.id, 1)}
                        className="h-9 flex-1"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Floating Cart Summary */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4 z-20">
            <div className="container mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  {totalItems} item{totalItems !== 1 ? 's' : ''}
                </div>
                <div className="text-2xl font-bold">
                  ${totalAmount.toFixed(2)}
                </div>
              </div>
              <Button
                size="lg"
                onClick={handlePlaceOrder}
                disabled={
                  placingOrder ||
                  (menuData.min_order_quantity && totalItems < menuData.min_order_quantity) ||
                  (menuData.max_order_quantity && totalItems > menuData.max_order_quantity)
                }
                className="min-w-[200px]"
              >
                {placingOrder ? (
                  'Processing...'
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Place Order
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">{zoomedImage?.name}</DialogTitle>
          {zoomedImage && (
            <div className="relative">
              <div className="absolute top-4 left-4 z-10">
                <Badge variant="secondary" className="text-lg px-4 py-2">
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
              <Badge className={`w-fit ${getStrainColor(selectedProduct.strain_type)} font-semibold`}>
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
                      <div key={weight} className="flex justify-between p-2 bg-muted rounded">
                        <span className="font-medium">{formatWeight(weight)}</span>
                        <span className="text-primary">${(price as number).toFixed(2)}</span>
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
                      <div className="p-3 bg-green-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {selectedProduct.thc_percentage.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">THC</div>
                      </div>
                    )}
                    {selectedProduct.cbd_percentage && (
                      <div className="p-3 bg-blue-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
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
                      <Badge key={idx} variant="secondary" className="text-sm py-1">
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

              {/* Grow Info */}
              {selectedProduct.grow_info && (
                <div>
                  <h4 className="font-semibold mb-2">Grow Information</h4>
                  <p className="text-muted-foreground text-sm">
                    {selectedProduct.grow_info}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Force rebuild - disposable menus with image support
export default SecureMenuView;
