import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Shield, ShoppingCart, Package, Minus, Plus, Lock, AlertTriangle, ZoomIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { OptimizedProductImage } from '@/components/OptimizedProductImage';
import { trackImageZoom } from '@/hooks/useMenuAnalytics';

const SecureMenuView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [menuData, setMenuData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placingOrder, setPlacingOrder] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    // Check session storage for validated menu access
    const storedMenu = sessionStorage.getItem(`menu_${token}`);
    console.log('Checking for menu data:', token, storedMenu ? 'found' : 'not found');
    if (storedMenu) {
      const parsed = JSON.parse(storedMenu);
      console.log('Menu data loaded:', parsed);
      console.log('Products count:', parsed.products?.length || 0);
      setMenuData(parsed);
      setLoading(false);
    } else {
      // Redirect back to access page if not validated
      navigate(`/m/${token}`);
    }
  }, [token, navigate]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [productId]: newQty };
    });
  };

  const calculateTotal = () => {
    return Object.entries(cart).reduce((sum, [productId, quantity]) => {
      const product = menuData?.products?.find((p: any) => p.id === productId);
      const price = product?.price || 0;
      return sum + (price * quantity);
    }, 0);
  };

  const handlePlaceOrder = async () => {
    if (Object.keys(cart).length === 0) return;

    setPlacingOrder(true);
    try {
      const orderItems = Object.entries(cart).map(([productId, quantity]) => {
        const product = menuData.products.find((p: any) => p.id === productId);
        const price = menuData.custom_prices?.[productId] || product?.price || 0;
        return {
          product_id: productId,
          quantity,
          unit_price: price
        };
      });

      const { data, error } = await supabase.functions.invoke('menu-order-place', {
        body: {
          menu_id: menuData.menu_id,
          whitelist_id: menuData.whitelist_id,
          order_items: orderItems,
          total_amount: calculateTotal(),
          customer_notes: ''
        }
      });

      if (error) throw error;

      showSuccessToast('Order Placed', 'Your order has been submitted successfully');
      setCart({});
      
      // Clear session after order
      setTimeout(() => {
        sessionStorage.removeItem(`menu_${token}`);
        navigate('/');
      }, 2000);
    } catch (err: any) {
      console.error('Order error:', err);
      showErrorToast('Order Failed', err.message || 'Could not place order');
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

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const totalAmount = calculateTotal();

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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-24">
          {!menuData.products || menuData.products.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No products available in this menu</p>
            </div>
          ) : (
            menuData.products.map((product: any) => {
              const quantity = cart[product.id] || 0;
              const shouldShowImage = menuData.appearance_settings?.show_product_images !== false;
              const imageUrl = product.image_url || product.images?.[0];

              return (
                <Card key={product.id} className="p-4">
                  <div className="space-y-3">
                    {/* Product Image */}
                    {shouldShowImage && imageUrl && (
                      <div 
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer group"
                        onClick={() => {
                          setZoomedImage({ url: imageUrl, name: product.name });
                          trackImageZoom(menuData.menu_id, product.id);
                        }}
                      >
                        <OptimizedProductImage
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full"
                          priority={false}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                          Click to zoom
                        </Badge>
                      </div>
                    )}
                    
                    {/* Product Info */}
                    <div>
                      <h3 className="font-bold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description || 'No description'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-primary">
                        ${(product.price || 0).toFixed(2)}
                      </div>
                      {menuData.appearance_settings?.show_availability !== false && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {product.quantity_lbs || 0} lbs
                        </Badge>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(product.id, -1)}
                        disabled={quantity === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setCart(prev => val === 0 ? 
                            Object.fromEntries(Object.entries(prev).filter(([k]) => k !== product.id)) :
                            { ...prev, [product.id]: val }
                          );
                        }}
                        className="w-20 text-center"
                        min={0}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(product.id, 1)}
                      >
                        <Plus className="h-4 w-4" />
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
    </div>
  );
};

export default SecureMenuView;
