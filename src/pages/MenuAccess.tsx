import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Eye, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useGeofencing } from '@/hooks/useGeofencing';
import { toast } from 'sonner';
import { initHoneypotSystem } from '@/utils/honeypotDetection';
import { MenuProductGrid } from '@/components/customer/MenuProductGrid';
import { MenuCart, CartItem } from '@/components/customer/MenuCart';
import { MenuOrderForm, OrderData } from '@/components/customer/MenuOrderForm';
import { ViewLimitExceeded } from '@/components/customer/ViewLimitExceeded';

const MenuAccess = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const uniqueToken = searchParams.get('u');

  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [menu, setMenu] = useState<any>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [error, setError] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [honeypotSystem, setHoneypotSystem] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [viewLimitExceeded, setViewLimitExceeded] = useState(false);

  // Enable screenshot protection if menu is loaded
  useScreenshotProtection({
    menuId: menu?.id || '',
    customerName: menu?.customer_name,
    enabled: accessGranted && menu?.screenshot_protection,
    watermarkEnabled: menu?.watermark_enabled,
    watermarkText: menu?.watermark_text || `CONFIDENTIAL - ${menu?.name}`,
    showToast: true,
    disableRightClickEnabled: menu?.disable_right_click,
  });

  // Geofencing validation
  const { isChecking: isCheckingLocation, accessGranted: locationAllowed, violation } = useGeofencing({
    geofences: menu?.geofence_rules || [],
    enabled: menu?.geofence_enabled || false,
    onViolation: async (details) => {
      await supabase.from('menu_security_events').insert({
        menu_id: menu?.id,
        event_type: 'geofence_violation',
        severity: 'high',
        details
      });
    }
  });

  // Initialize honeypot
  useEffect(() => {
    const form = document.querySelector('form');
    if (form && !honeypotSystem) {
      const system = initHoneypotSystem(form);
      setHoneypotSystem(system);
      return () => system.cleanup();
    }
  }, [honeypotSystem]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (numericValue.length <= 1) {
      const newDigits = [...codeDigits];
      newDigits[index] = numericValue;
      setCodeDigits(newDigits);
      
      // Auto-advance to next input
      if (numericValue && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
      
      // Auto-submit when all 4 digits are entered
      if (index === 3 && numericValue) {
        const fullCode = [...newDigits.slice(0, 3), numericValue].join('');
        if (fullCode.length === 4) {
          handleValidate(fullCode);
        }
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      const fullCode = codeDigits.join('');
      if (fullCode.length === 4) {
        handleValidate(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
    if (pastedData) {
      const newDigits = pastedData.split('').concat(['', '', '', '']).slice(0, 4);
      setCodeDigits(newDigits);
      
      // Focus the next empty input or last input
      const nextEmptyIndex = newDigits.findIndex(d => !d);
      if (nextEmptyIndex !== -1) {
        inputRefs.current[nextEmptyIndex]?.focus();
      } else {
        inputRefs.current[3]?.focus();
        if (pastedData.length === 4) {
          handleValidate(pastedData);
        }
      }
    }
  };

  const handleValidate = async (code?: string) => {
    const accessCode = code || codeDigits.join('');
    
    if (!accessCode || accessCode.length !== 4) {
      setError('Please enter a 4-digit access code');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Call validation edge function
      const { data, error } = await supabase.functions.invoke('menu-access-validate', {
        body: {
          encrypted_url_token: token,
          access_code: accessCode,
          unique_access_token: uniqueToken,
          device_fingerprint: generateFingerprint(),
        },
      });

      if (error) throw error;

      if (data.access_granted) {
        setMenu(data.menu);
        setAccessGranted(true);
        setViewCount(data.remaining_views || 0);
        
        // Check if view limit exceeded
        if (data.remaining_views <= 0) {
          setViewLimitExceeded(true);
        }
        
        toast.success('Access granted!');
      } else {
        setError(data.violations?.join(', ') || 'Access denied');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate access');
    } finally {
      setIsValidating(false);
    }
  };

  const generateFingerprint = () => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ];
    return btoa(components.join('|'));
  };

  const handleAddToCart = (productId: string, quantity: number) => {
    const product = menu.products.find((p: any) => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.product_id === productId);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: productId,
        name: product.name,
        price: product.price,
        quantity,
        min_quantity: product.min_quantity || 1,
        max_quantity: product.stock || 999
      }]);
    }

    toast.success('Added to cart!');
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    
    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
    toast.success('Removed from cart');
  };

  const handleCheckout = () => {
    setShowOrderForm(true);
  };

  const handleSubmitOrder = async (orderData: OrderData) => {
    setIsSubmittingOrder(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('menu-order-place', {
        body: {
          menu_id: menu.id,
          access_token: uniqueToken,
          order_items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price_per_unit: item.price
          })),
          ...orderData
        }
      });

      if (error) throw error;

      toast.success('Order placed successfully!', {
        description: `Order #${data.order_id} is being reviewed`
      });

      // Clear cart and reset
      setCart([]);
      setShowOrderForm(false);
      
      // Optionally redirect or show confirmation
    } catch (err: any) {
      toast.error('Failed to place order', {
        description: err.message
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (!accessGranted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold mb-2">Secure Menu Access</h1>
            <p className="text-muted-foreground">
              You've been invited to view a private catalog
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="code-0" className="text-center block mb-3">
                Enter 4-Digit Access Code
              </Label>
              <div className="flex gap-3 justify-center">
                {[0, 1, 2, 3].map((index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    id={`code-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={codeDigits[index]}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="w-16 h-16 text-center text-3xl font-bold"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Paste your code or type each digit
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              onClick={() => handleValidate()}
              disabled={isValidating || codeDigits.join('').length !== 4}
              className="w-full"
              size="lg"
            >
              {isValidating ? (
                <>Validating...</>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Access Menu
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              This catalog is confidential
            </p>
            <p className="flex items-center gap-2">
              <Eye className="h-3 w-3" />
              Screenshots are tracked
            </p>
            <p className="flex items-center gap-2">
              <Lock className="h-3 w-3" />
              Do not share this link
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // View limit exceeded
  if (viewLimitExceeded) {
    return (
      <ViewLimitExceeded
        viewLimit={menu?.view_limit || 5}
        menuName={menu?.name}
        contactInfo={menu?.contact_info}
      />
    );
  }

  // Order form view
  if (showOrderForm) {
    return (
      <MenuOrderForm
        items={cart}
        onBack={() => setShowOrderForm(false)}
        onSubmit={handleSubmitOrder}
        isSubmitting={isSubmittingOrder}
      />
    );
  }

  // Menu view after access granted
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{menu.custom_message || 'Wholesale Catalog'}</h1>
              <p className="text-sm text-muted-foreground">
                Min order: {menu.min_order_quantity || 5} lbs
              </p>
            </div>
            {viewCount > 0 && (
              <Badge variant={viewCount <= 2 ? 'destructive' : 'outline'}>
                <Eye className="h-3 w-3 mr-1" />
                {viewCount} views left
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="container mx-auto px-4 py-8">
        <MenuProductGrid
          products={menu.products || []}
          showImages={menu.show_product_images}
          showAvailability={menu.show_availability}
          onAddToCart={handleAddToCart}
          minOrderQty={menu.min_order_quantity}
        />
      </div>

      {/* Cart */}
      <MenuCart
        items={cart}
        minOrderTotal={menu.min_order_quantity || 0}
        maxOrderTotal={menu.max_order_quantity || 999999}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
};

export default MenuAccess;